"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { SparklesIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { useProgressMessages } from "@/lib/hooks/useProgressMessages";
import {
  COVER_LETTER_FOCUS,
  COVER_LETTER_LANGUAGES,
  COVER_LETTER_LENGTHS,
  COVER_LETTER_LIMITS,
  COVER_LETTER_TONES,
  DEFAULT_LANGUAGE,
  DEFAULT_LENGTH,
  DEFAULT_TONE,
  MAX_FOCUS,
  type CoverLetterFocus,
  type CoverLetterLanguage,
  type CoverLetterLength,
  type CoverLetterTone,
} from "@/lib/coverLetter/config";
import { validateCreateInput } from "@/lib/coverLetter/validation";
import { clsx } from "@/lib/utils";

interface SourceResume {
  id: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  hasContent: boolean;
  isThin: boolean;
}

interface Bootstrap {
  canCreate: boolean;
  resumes: SourceResume[];
}

type Mode = "ai" | "blank";
type Dialog = null | "discard" | "thin" | "paywall" | "session";
type Phase = "form" | "generating" | "failed";

interface Form {
  resumeId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  hiringManager: string;
  mode: Mode;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  language: CoverLetterLanguage;
  focus: CoverLetterFocus[];
}

const EMPTY_FORM: Form = {
  resumeId: "",
  jobTitle: "",
  company: "",
  jobDescription: "",
  hiringManager: "",
  mode: "ai",
  tone: DEFAULT_TONE,
  length: DEFAULT_LENGTH,
  language: DEFAULT_LANGUAGE,
  focus: [],
};

const GENERATING_MESSAGES = ["Reading your resume...", "Matching it to the role...", "Writing your letter..."];
const PROFILE_FIELDS = ["jobTitle", "company", "jobDescription"] as const;

function resumeLabel(resume: SourceResume): string {
  return [resume.jobTitle || "Untitled resume", resume.company].filter(Boolean).join(" - ");
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-secondary">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={clsx(
              "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === option.value ? "border-accent bg-accent-soft text-accent" : "border-border text-ink-secondary hover:bg-paper-deep"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The two-step "Create a cover letter" setup. Nothing is navigated away from until the letter exists:
 * closing it, cancelling a generation or a failed one all keep the form exactly as the user left it.
 */
export function NewCoverLetterModal({
  isOpen,
  onClose,
  initialResumeId = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The resume being edited when opened from the editor; null from the hub, where the user picks one. */
  initialResumeId?: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idempotencyKey = useRef("");
  // Which prefilled fields the user has typed in, so choosing another resume never overwrites their edits.
  const edited = useRef(new Set<string>());

  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [bootError, setBootError] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [dirty, setDirty] = useState(false);
  const [thinAcknowledged, setThinAcknowledged] = useState(false);
  const [withoutResume, setWithoutResume] = useState(false);

  const isGenerating = phase === "generating";
  const progressMessage = useProgressMessages(GENERATING_MESSAGES, isGenerating);
  const hasResumes = (boot?.resumes.length ?? 0) > 0;
  const selectedResume = boot?.resumes.find((r) => r.id === form.resumeId) ?? null;
  // With no resume to write from, the only option is a blank letter.
  const canUseAi = hasResumes && !withoutResume;

  const applyResume = useCallback((resume: SourceResume | undefined) => {
    setForm((current) => {
      const next = { ...current, resumeId: resume?.id ?? "" };
      if (resume) {
        for (const field of PROFILE_FIELDS) {
          if (!edited.current.has(field)) next[field] = resume[field];
        }
      }
      return next;
    });
  }, []);

  const loadBootstrap = useCallback(async () => {
    setBootError(false);
    try {
      const response = await fetch("/api/cover-letters/entitlements");
      if (response.status === 401) return setDialog("session");
      if (!response.ok) throw new Error("bootstrap failed");
      const data = (await response.json()) as Bootstrap;
      setBoot(data);
      const initial = data.resumes.find((r) => r.id === initialResumeId);
      applyResume(initial);
    } catch {
      setBootError(true);
    }
  }, [applyResume, initialResumeId]);

  // Fresh state every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    idempotencyKey.current = crypto.randomUUID();
    edited.current = new Set();
    setForm(EMPTY_FORM);
    setErrors({});
    setStep(1);
    setPhase("form");
    setDialog(null);
    setDirty(false);
    setThinAcknowledged(false);
    setWithoutResume(false);
    setBoot(null);
    void loadBootstrap();
    return () => abortRef.current?.abort();
  }, [isOpen, loadBootstrap]);

  // A placeholder-only title leaves the field empty: put the cursor there.
  useEffect(() => {
    if (boot && step === 1 && !form.jobTitle) titleRef.current?.focus();
    // Only when the form first becomes ready, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot, step]);

  const requestClose = useCallback(() => {
    if (isGenerating) return;
    if (dirty) setDialog("discard");
    else onClose();
  }, [dirty, isGenerating, onClose]);

  // Escape and a Tab focus trap for the panel; a nested dialog owns those keys while it is open.
  useEffect(() => {
    if (!isOpen || dialog) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") return requestClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dialog, requestClose]);

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    if (key !== "resumeId") edited.current.add(key);
    setDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: "" } : current));
  }

  function toggleFocus(item: CoverLetterFocus) {
    setField(
      "focus",
      form.focus.includes(item) ? form.focus.filter((f) => f !== item) : form.focus.length < MAX_FOCUS ? [...form.focus, item] : form.focus
    );
  }

  const step1Errors = useMemo(
    () => validateCreateInput({ ...form, mode: canUseAi ? "ai" : "blank", resumeId: canUseAi ? form.resumeId : "" }).errors,
    [form, canUseAi]
  );
  const step1Valid = Object.keys(step1Errors).length === 0;

  /** Server-side field errors, plus live errors for fields the user has already touched. */
  function fieldError(key: keyof typeof step1Errors): string | undefined {
    return errors[key] || (edited.current.has(key) ? step1Errors[key] : undefined);
  }

  function goToStep2() {
    if (!step1Valid) {
      setErrors(step1Errors);
      return;
    }
    setStep(2);
  }

  async function create(mode: Mode) {
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("generating");
    try {
      const response = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ ...form, mode, resumeId: form.resumeId || null, idempotencyKey: idempotencyKey.current }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (mode === "blank") showToast("Cover letter created");
        router.push(`/cover-letter/${data.coverLetter.id}`);
        return;
      }
      setPhase("form");
      if (response.status === 401) return setDialog("session");
      if (response.status === 402 || data.code === "FREE_LIMIT_REACHED") return setDialog("paywall");
      if (response.status === 400 && data.fields) {
        setErrors(data.fields);
        return setStep(1);
      }
      setPhase("failed");
    } catch (error) {
      // Cancel: back to step 2 with everything preserved; the server refunds anything it reserved.
      setPhase(error instanceof DOMException && error.name === "AbortError" ? "form" : "failed");
    }
  }

  function handleCreate(skipThinCheck = false) {
    if (phase === "generating") return;
    if (form.mode === "ai" && !skipThinCheck && !thinAcknowledged && selectedResume?.isThin) {
      return setDialog("thin");
    }
    if (boot && !boot.canCreate) return setDialog("paywall");
    void create(form.mode);
  }

  function startBlank() {
    setForm((current) => ({ ...current, mode: "blank" }));
    void create("blank");
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-xs" onClick={requestClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-cover-letter-title"
          className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h2 id="new-cover-letter-title" className="font-display text-h3 text-ink">
                Create a cover letter
              </h2>
              <p className="text-xs text-ink-muted">Step {step} of 2</p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={isGenerating}
              aria-label="Close"
              className="rounded-full p-1 text-ink-muted hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {bootError && (
              <div role="alert" className="flex flex-col items-start gap-3 text-sm text-ink-secondary">
                We couldn&apos;t load your resumes.
                <Button type="button" size="sm" variant="outline" onClick={() => void loadBootstrap()}>
                  Try again
                </Button>
              </div>
            )}

            {!bootError && !boot && (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {boot && phase === "generating" && (
              <div className="flex flex-col gap-4" aria-busy="true">
                <p role="status" aria-live="polite" className="text-sm font-medium text-ink">
                  {progressMessage}
                </p>
                <div className="flex flex-col gap-2 rounded border border-border bg-white p-6">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="self-start text-sm text-ink-secondary underline underline-offset-2 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            )}

            {boot && phase === "failed" && (
              <div role="alert" className="flex flex-col gap-3 rounded border border-critical/30 bg-critical/5 p-5">
                <h3 className="font-display text-h3 text-ink">We couldn&apos;t generate your letter.</h3>
                <p className="text-sm text-ink-secondary">You haven&apos;t been charged a credit.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void create(form.mode)}>
                    Try again
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={startBlank}>
                    Start from blank
                  </Button>
                </div>
              </div>
            )}

            {boot && phase === "form" && step === 1 && (
              <div className="flex flex-col gap-4">
                {hasResumes && !withoutResume ? (
                  <Select
                    id="cl-resume"
                    label="Source resume"
                    value={form.resumeId}
                    error={errors.resumeId}
                    onChange={(e) => {
                      setDirty(true);
                      applyResume(boot.resumes.find((r) => r.id === e.target.value));
                    }}
                  >
                    <option value="">Choose a resume</option>
                    {boot.resumes.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resumeLabel(resume)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="rounded border border-border bg-paper-deep/40 p-4 text-sm text-ink-secondary">
                    <p>You don&apos;t have a resume yet. Create one so we can personalise your letter.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button href="/resume/new" size="sm">
                        Create resume
                      </Button>
                      {!withoutResume && (
                        <Button type="button" size="sm" variant="outline" onClick={() => setWithoutResume(true)}>
                          Continue without resume
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <Input
                  ref={titleRef}
                  label="Job title"
                  value={form.jobTitle}
                  maxLength={COVER_LETTER_LIMITS.jobTitleMax}
                  error={fieldError("jobTitle")}
                  onChange={(e) => setField("jobTitle", e.target.value)}
                />
                <Input
                  label="Company name"
                  value={form.company}
                  maxLength={COVER_LETTER_LIMITS.companyMax}
                  error={fieldError("company")}
                  onChange={(e) => setField("company", e.target.value)}
                />
                <div className="flex flex-col gap-1">
                  <Textarea
                    label="Job description"
                    rows={5}
                    value={form.jobDescription}
                    error={fieldError("jobDescription")}
                    onChange={(e) => setField("jobDescription", e.target.value)}
                  />
                  <div className="flex justify-between text-xs text-ink-muted">
                    <span>Paste the job ad for a more tailored letter.</span>
                    <span className={form.jobDescription.length > COVER_LETTER_LIMITS.jobDescriptionMax ? "text-critical" : undefined}>
                      {form.jobDescription.length.toLocaleString("en-US")} / {COVER_LETTER_LIMITS.jobDescriptionMax.toLocaleString("en-US")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Input
                    label="Hiring manager name (optional)"
                    value={form.hiringManager}
                    maxLength={COVER_LETTER_LIMITS.hiringManagerMax}
                    error={fieldError("hiringManager")}
                    onChange={(e) => setField("hiringManager", e.target.value)}
                  />
                  <span className="text-xs text-ink-muted">Leave blank to use &apos;Dear Hiring Manager&apos;.</span>
                </div>
              </div>
            )}

            {boot && phase === "form" && step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Creation method">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mode === "ai"}
                    disabled={!canUseAi}
                    onClick={() => setField("mode", "ai")}
                    className={clsx(
                      "flex flex-col gap-1 rounded border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                      form.mode === "ai" ? "border-accent bg-accent-soft/50" : "border-border hover:bg-paper-deep"
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <SparklesIcon className="h-4 w-4 text-accent" /> Generate with AI
                      <span className="rounded-pill bg-accent px-2 py-0.5 text-[10px] font-semibold text-on-accent">Recommended</span>
                    </span>
                    <span className="text-xs text-ink-secondary">
                      We&apos;ll write a first draft from your resume and the job description.
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mode === "blank"}
                    onClick={() => setField("mode", "blank")}
                    className={clsx(
                      "flex flex-col gap-1 rounded border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      form.mode === "blank" ? "border-accent bg-accent-soft/50" : "border-border hover:bg-paper-deep"
                    )}
                  >
                    <span className="text-sm font-semibold text-ink">Start from blank</span>
                    <span className="text-xs text-ink-secondary">Write it yourself with our editor and templates.</span>
                  </button>
                </div>

                {form.mode === "ai" && (
                  <div className="flex flex-col gap-4">
                    <Segmented
                      label="Tone"
                      value={form.tone}
                      options={COVER_LETTER_TONES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
                      onChange={(v) => setField("tone", v)}
                    />
                    <Segmented
                      label="Length"
                      value={form.length}
                      options={(Object.keys(COVER_LETTER_LENGTHS) as CoverLetterLength[]).map((k) => ({
                        value: k,
                        label: `${COVER_LETTER_LENGTHS[k].label} (~${COVER_LETTER_LENGTHS[k].words} words)`,
                      }))}
                      onChange={(v) => setField("length", v)}
                    />
                    <Select
                      id="cl-language"
                      label="Language"
                      value={form.language}
                      onChange={(e) => setField("language", e.target.value as CoverLetterLanguage)}
                    >
                      {COVER_LETTER_LANGUAGES.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </Select>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-ink-secondary">Focus (optional, up to {MAX_FOCUS})</span>
                      <div className="flex flex-wrap gap-1.5">
                        {COVER_LETTER_FOCUS.map((item) => {
                          const selected = form.focus.includes(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              aria-pressed={selected}
                              disabled={!selected && form.focus.length >= MAX_FOCUS}
                              onClick={() => toggleFocus(item)}
                              className={clsx(
                                "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                                selected ? "border-accent bg-accent-soft text-accent" : "border-border text-ink-secondary hover:bg-paper-deep"
                              )}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {boot && phase === "form" && (
            <div className="flex justify-between gap-3 border-t border-border px-6 py-4">
              {step === 1 ? (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={requestClose}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" disabled={!step1Valid} onClick={goToStep2}>
                    Next
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="button" size="sm" onClick={() => handleCreate()}>
                    Create cover letter
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {dialog === "discard" && (
        <ConfirmDialog
          title="Discard this cover letter?"
          description="Your progress will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          isDestructive
          onConfirm={() => {
            setDialog(null);
            onClose();
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === "thin" && (
        <ConfirmDialog
          title="Your resume is a bit empty"
          description="A stronger resume means a stronger cover letter. Adding your experience or skills helps us write something specific to you."
          confirmLabel="Improve my resume"
          cancelLabel="Continue anyway"
          // Escape or a backdrop click backs out to step 2; only the button starts the generation.
          onDismiss={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            router.push(`/resume/${form.resumeId}`);
          }}
          onCancel={() => {
            setDialog(null);
            setThinAcknowledged(true);
            handleCreate(true);
          }}
        />
      )}

      {dialog === "session" && (
        <ConfirmDialog
          title="Sign in to continue"
          description="Your session has expired. Sign in to keep your progress."
          confirmLabel="Sign in"
          cancelLabel="Cancel"
          onConfirm={() => {
            // A new tab, so the form stays in memory here and the user can retry once signed in.
            window.open("/login", "_blank");
            setDialog(null);
          }}
          onCancel={() => {
            setDialog(null);
            // Expired before the form ever loaded: nothing to keep, so don't leave an empty shell open.
            if (!boot) onClose();
          }}
        />
      )}

      <LimitReachedModal
        isOpen={dialog === "paywall"}
        onClose={() => setDialog(null)}
        title="You've used your free cover letter"
        message="Upgrade to create unlimited cover letters, use AI rewrites and download your documents."
      />
    </>
  );
}
