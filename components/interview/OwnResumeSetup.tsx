"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { CheckIcon, FileTextIcon, PencilIcon, TrashIcon } from "@/components/ui/icons/LucideIcons";
import { trackFunnelEvent } from "@/lib/analytics";
import { formatEnAuDate } from "@/lib/dateUtils";
import { clsx } from "@/lib/utils";
import {
  MAX_UPLOADED_RESUME_NAME,
  MIN_JOB_AD_TEXT_LENGTH,
  MIN_RESUME_TEXT_LENGTH,
  findTrackedJob,
} from "@/lib/interview/uploadedResume";
import type { Application, ApplicationInterview, UploadedResumeSummary } from "@/types";

/** The practice is linked to this tracked application (and its next interview, if any). */
export interface TrackerLink {
  applicationId: string;
  interviewId: string | null;
  label: string;
}

export interface OwnResumeDraft {
  uploadedResumeId: string | null;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  link: TrackerLink | null;
}

export const EMPTY_OWN_RESUME_DRAFT: OwnResumeDraft = {
  uploadedResumeId: null,
  jobDescription: "",
  jobTitle: "",
  companyName: "",
  link: null,
};

export function ownDraftReady(d: OwnResumeDraft): boolean {
  return Boolean(d.uploadedResumeId && d.jobTitle.trim() && d.jobDescription.trim().length >= MIN_JOB_AD_TEXT_LENGTH);
}

const SOURCE_LABELS: Record<UploadedResumeSummary["source"], string> = { pdf: "PDF", docx: "Word", paste: "Pasted" };
const JOB_AD_AUTOFILL_DELAY_MS = 700;

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : fallback;
}

export function OwnResumeSetup({
  savedResumes,
  onSavedResumesChange,
  draft,
  onDraftChange,
  applications,
  interviews,
  onUseTailored,
}: {
  savedResumes: UploadedResumeSummary[];
  onSavedResumesChange: (next: UploadedResumeSummary[]) => void;
  draft: OwnResumeDraft;
  onDraftChange: (next: OwnResumeDraft) => void;
  applications: Application[];
  interviews: ApplicationInterview[];
  /** Back to tailored resumes; absent when there are none. */
  onUseTailored?: () => void;
}) {
  const [adding, setAdding] = useState(savedResumes.length === 0);
  const [addTab, setAddTab] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<UploadedResumeSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [readingAd, setReadingAd] = useState(false);
  const autofillRun = useRef(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const [trackerDeclined, setTrackerDeclined] = useState<string | null>(null);
  const [trackerBusy, setTrackerBusy] = useState(false);
  const [trackerError, setTrackerError] = useState<string | null>(null);

  const update = (patch: Partial<OwnResumeDraft>) => onDraftChange({ ...draftRef.current, ...patch });

  // Fill an empty title or company from the pasted ad (the same cached parse the session uses).
  // Only empty fields: what the user typed, or an earlier fill, is never replaced.
  useEffect(() => {
    const ad = draft.jobDescription.trim();
    const run = ++autofillRun.current;
    const { jobTitle, companyName } = draftRef.current;
    if (ad.length < MIN_JOB_AD_TEXT_LENGTH || (jobTitle.trim() && companyName.trim())) {
      setReadingAd(false);
      return;
    }
    const timer = setTimeout(async () => {
      setReadingAd(true);
      try {
        const res = await fetch("/api/parse-job-ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adText: ad }),
        });
        if (!res.ok || run !== autofillRun.current) return;
        const parsed = (await res.json()) as { title?: string; company?: string };
        const patch: Partial<OwnResumeDraft> = {};
        if (!draftRef.current.jobTitle.trim() && parsed.title) patch.jobTitle = parsed.title;
        if (!draftRef.current.companyName.trim() && parsed.company) patch.companyName = parsed.company;
        if (Object.keys(patch).length) update(patch);
      } catch {
        // Autofill is a convenience: the fields stay editable either way.
      } finally {
        if (run === autofillRun.current) setReadingAd(false);
      }
    }, JOB_AD_AUTOFILL_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reruns only when the ad text changes
  }, [draft.jobDescription]);

  async function saveResume(body: FormData | { text: string }, source: UploadedResumeSummary["source"] | "file") {
    setSaving(true);
    setResumeError(null);
    try {
      const res = await fetch(
        "/api/interview/uploaded-resumes",
        body instanceof FormData
          ? { method: "POST", body }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error(await readError(res, "We couldn't read that resume. Try again."));
      const { resume } = (await res.json()) as { resume: UploadedResumeSummary };
      onSavedResumesChange([resume, ...savedResumes]);
      update({ uploadedResumeId: resume.id });
      setAdding(false);
      setPasteText("");
      trackFunnelEvent("interview_uploaded_resume_saved", { source: source === "file" ? resume.source : source });
    } catch (err) {
      setResumeError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again still triggers a change
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    void saveResume(form, "file");
  }

  async function saveRename() {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    const res = await fetch(`/api/interview/uploaded-resumes/${renaming.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setResumeError(await readError(res, "Couldn't rename that resume."));
      return;
    }
    const { resume } = (await res.json()) as { resume: UploadedResumeSummary };
    onSavedResumesChange(savedResumes.map((r) => (r.id === resume.id ? resume : r)));
    setRenaming(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    const res = await fetch(`/api/interview/uploaded-resumes/${deleting.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (!res.ok) {
      setResumeError(await readError(res, "Couldn't delete that resume."));
      setDeleting(null);
      return;
    }
    const remaining = savedResumes.filter((r) => r.id !== deleting.id);
    onSavedResumesChange(remaining);
    if (draft.uploadedResumeId === deleting.id) update({ uploadedResumeId: null });
    if (remaining.length === 0) setAdding(true);
    setDeleting(null);
  }

  // Tracker question: asked once the job has a title and company.
  const trackerKey = `${draft.jobTitle.trim().toLowerCase()}|${draft.companyName.trim().toLowerCase()}`;
  const canAskTracker =
    !draft.link &&
    !readingAd &&
    Boolean(draft.jobTitle.trim() && draft.companyName.trim()) &&
    draft.jobDescription.trim().length >= MIN_JOB_AD_TEXT_LENGTH &&
    trackerDeclined !== trackerKey;
  const tracked = canAskTracker ? findTrackedJob(applications, interviews, draft.jobTitle, draft.companyName) : null;

  function linkTracked() {
    if (!tracked) return;
    update({
      link: {
        applicationId: tracked.application.id,
        interviewId: tracked.nextInterview?.id ?? null,
        label: [tracked.application.job_title, tracked.application.company_name].filter(Boolean).join(" at "),
      },
    });
    trackFunnelEvent("interview_job_linked_to_tracker", { has_interview: Boolean(tracked.nextInterview) });
  }

  async function addToTracker() {
    setTrackerBusy(true);
    setTrackerError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_title: draft.jobTitle.trim(), company_name: draft.companyName.trim(), confirmed: true }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't add this job to your tracker."));
      const { application } = (await res.json()) as { application: Application };
      update({
        link: {
          applicationId: application.id,
          interviewId: null,
          label: [application.job_title, application.company_name].filter(Boolean).join(" at "),
        },
      });
      trackFunnelEvent("interview_job_added_to_tracker");
    } catch (err) {
      setTrackerError((err as Error).message);
    } finally {
      setTrackerBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    clsx(
      "flex flex-1 items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      active ? "bg-accent font-semibold text-on-accent shadow-sm" : "text-ink-secondary hover:text-ink"
    );

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold leading-snug text-ink">Upload my resume</h2>
          <p className="mt-0.5 text-xs text-ink-secondary">Use any resume, even one not made in ApplyLab.</p>
        </div>
        {onUseTailored && (
          <Button variant="ghost" size="sm" onClick={onUseTailored} className="self-start rounded-pill text-xs">
            Use an ApplyLab resume instead
          </Button>
        )}
      </div>

      {/* 1. The resume */}
      <section aria-labelledby="own-resume-heading" className="flex flex-col gap-3">
        <h3 id="own-resume-heading" className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
          Your resume
        </h3>

        {savedResumes.length > 0 && (
          <div role="radiogroup" aria-labelledby="own-resume-heading" className="flex flex-col gap-2">
            {savedResumes.map((r) => {
              const isSel = r.id === draft.uploadedResumeId;
              const isRenaming = renaming?.id === r.id;
              return (
                <div
                  key={r.id}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    isSel ? "border-accent bg-accent-soft/30" : "border-border bg-paper"
                  )}
                >
                  {isRenaming ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveRename();
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Resume name"
                        value={renaming.name}
                        maxLength={MAX_UPLOADED_RESUME_NAME}
                        onChange={(e) => setRenaming({ id: r.id, name: e.target.value })}
                        onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                        className="min-w-0 flex-1 rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <Button type="submit" size="sm" className="rounded-pill text-xs">
                        Save
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)} className="rounded-pill text-xs">
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSel}
                        onClick={() => update({ uploadedResumeId: r.id })}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                            isSel ? "border-accent bg-accent text-on-accent" : "border-border-strong"
                          )}
                        >
                          {isSel && <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                          <span className="block text-[11.5px] text-ink-muted">
                            {SOURCE_LABELS[r.source]} · added {formatEnAuDate(r.created_at)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming({ id: r.id, name: r.name })}
                        aria-label={`Rename ${r.name}`}
                        className="rounded p-1.5 text-ink-muted hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(r)}
                        aria-label={`Delete ${r.name}`}
                        className="rounded p-1.5 text-ink-muted hover:bg-critical-soft hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {adding ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-paper p-3.5">
            <div role="tablist" aria-label="How to add your resume" className="inline-flex w-full rounded-pill bg-paper-deep p-1 sm:max-w-xs">
              <button type="button" role="tab" aria-selected={addTab === "file"} onClick={() => setAddTab("file")} className={tabClass(addTab === "file")}>
                Upload a file
              </button>
              <button type="button" role="tab" aria-selected={addTab === "paste"} onClick={() => setAddTab("paste")} className={tabClass(addTab === "paste")}>
                Paste text
              </button>
            </div>

            {addTab === "file" ? (
              <label
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded border-2 border-dashed border-border-strong p-6 text-center text-sm text-ink-secondary transition-colors duration-fast ease-editorial",
                  saving ? "cursor-wait opacity-70" : "cursor-pointer hover:border-accent"
                )}
              >
                <FileTextIcon className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                <span className="font-semibold text-ink">{saving ? "Reading your resume…" : "Choose a PDF or Word file"}</span>
                <span className="text-xs text-ink-muted">Up to 5 MB. We keep the text, not the file.</span>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={handleFile}
                  disabled={saving}
                />
              </label>
            ) : (
              <div className="flex flex-col gap-2">
                <Textarea
                  aria-label="Your resume"
                  placeholder="Paste your whole resume here"
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={saving}
                />
                <Button
                  size="sm"
                  onClick={() => void saveResume({ text: pasteText }, "paste")}
                  isLoading={saving}
                  disabled={pasteText.trim().length < MIN_RESUME_TEXT_LENGTH}
                  className="self-start rounded-pill"
                >
                  {saving ? "Reading your resume…" : "Save resume"}
                </Button>
              </div>
            )}

            {savedResumes.length > 0 && !saving && (
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} className="self-start rounded-pill text-xs">
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="self-start rounded-pill text-xs">
            Add another resume
          </Button>
        )}

        {resumeError && (
          <p role="alert" className="rounded-lg bg-critical-soft p-3 text-xs text-ink">
            {resumeError}
          </p>
        )}
      </section>

      {/* 2. The job */}
      <section aria-labelledby="own-job-heading" className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 id="own-job-heading" className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
          The job
        </h3>
        <Textarea
          label="Job ad"
          placeholder="Paste the whole job ad here"
          rows={7}
          value={draft.jobDescription}
          onChange={(e) => update({ jobDescription: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Job title"
            value={draft.jobTitle}
            placeholder={readingAd ? "Reading the ad…" : "e.g. Marketing Coordinator"}
            onChange={(e) => update({ jobTitle: e.target.value, link: null })}
          />
          <Input
            label="Company"
            value={draft.companyName}
            placeholder={readingAd ? "Reading the ad…" : "e.g. Acme"}
            onChange={(e) => update({ companyName: e.target.value, link: null })}
          />
        </div>

        {draft.link ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success-soft p-3">
            <span className="flex items-center gap-2 text-xs text-ink">
              <CheckIcon className="h-4 w-4 shrink-0 text-success" strokeWidth={2} />
              Linked to your tracker: <strong className="font-semibold">{draft.link.label || "this job"}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTrackerDeclined(trackerKey);
                update({ link: null });
              }}
              className="shrink-0 rounded-pill text-xs"
            >
              Unlink
            </Button>
          </div>
        ) : (
          canAskTracker && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-paper p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink">
                {tracked ? (
                  <>
                    Is this practice for your interview at{" "}
                    <strong className="font-semibold">{tracked.application.company_name}</strong>?
                  </>
                ) : (
                  "Want to add this job to your tracker?"
                )}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  onClick={tracked ? linkTracked : addToTracker}
                  isLoading={trackerBusy}
                  className="rounded-pill text-xs"
                >
                  {tracked ? "Yes" : "Add to tracker"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTrackerDeclined(trackerKey)}
                  disabled={trackerBusy}
                  className="rounded-pill text-xs"
                >
                  {tracked ? "No" : "No thanks"}
                </Button>
              </div>
            </div>
          )
        )}
        {trackerError && (
          <p role="alert" className="rounded-lg bg-critical-soft p-3 text-xs text-ink">
            {trackerError}
          </p>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          description="Your past practice sessions and reports for it are kept."
          confirmLabel="Delete"
          isDestructive
          isConfirming={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
