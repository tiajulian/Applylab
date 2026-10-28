"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  LayoutGridIcon,
  LockIcon,
  PaletteIcon,
  PencilIcon,
  ShieldCheckIcon,
  TargetIcon,
  UserIcon,
} from "@/components/ui/icons/LucideIcons";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { useAccountGate } from "@/components/auth/AccountGate";
import { GenerationProgress } from "@/components/resume/GenerationProgress";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { ResumeFileDrop } from "@/components/resume/ResumeFileDrop";
import { ResumeSourcePicker, type ResumeSource } from "@/components/resume/ResumeSourcePicker";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { usePreGenerateCheck } from "@/lib/hooks/usePreGenerateCheck";
import type { CheckInput } from "@/lib/text/preGenerateCheck";
import { hasResumeContent, importedProfileToUserProfile } from "@/lib/resume/importedProfile";

// How long a click waits for the captcha before giving up. Generous, because when Cloudflare does
// show a challenge the user has to notice and solve it.
const CAPTCHA_WAIT_MS = 60_000;

const TIMED_OUT_MESSAGE = "Something went wrong, and the request may have timed out. Please try again.";

/**
 * The no-job-ad path. It starts from one of three sources: the saved profile, an uploaded resume
 * file (parsed, written up from the file alone, and its new details added to the saved profile),
 * or a blank resume the user fills in themselves. None of them use the skills bridge, which only
 * exists to map experience onto a specific job ad.
 */
export function GeneralResumeForm({
  source,
  onSourceChange,
  profileReady,
  disabled = false,
  isPaidPlan,
  remaining,
  limit,
  checkInput,
}: {
  source: ResumeSource;
  onSourceChange: (source: ResumeSource) => void;
  /** Whether the saved profile has enough to write from. */
  profileReady: boolean;
  /** Blocks the profile source only: the other two don't read the profile. */
  disabled?: boolean;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
  /** Profile text to spell/grammar-check before generating from the profile; no check when omitted. */
  checkInput?: CheckInput;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  // True from the click until generation starts or is abandoned (spell check, sign-in check).
  const [isPreparing, setIsPreparing] = useState(false);
  const { confirm: confirmTextCheck, modal: textCheckModal } = usePreGenerateCheck();
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  // Set when the server reports the limit (e.g. the last free resume was used in another tab), so
  // the card switches to the Go Pro panel without waiting for a reload to refresh `remaining`.
  const [serverSaidExhausted, setServerSaidExhausted] = useState(false);
  const { requireAccount } = useAccountGate();

  const [file, setFile] = useState<File | null>(null);
  // The parsed upload, kept so a retry after a failed generation doesn't read the file again.
  const parsedRef = useRef<{ file: File; profile: unknown } | null>(null);
  // The parse endpoint needs a fresh, single-use captcha token per call.
  const [captchaKey, setCaptchaKey] = useState(0);
  const tokenRef = useRef<string | null>(null);
  const tokenWaitersRef = useRef<Array<(token: string) => void>>([]);

  // Out of free resumes: the submit button is replaced by the Go Pro panel below.
  const resumeQuotaExhausted = serverSaidExhausted || (!isPaidPlan && remaining !== null && remaining <= 0);
  const isBusy = isGenerating || isPreparing;
  const submitBlocked = source === "profile" ? disabled : source === "upload" ? !file : false;

  function handleToken(token: string | null) {
    tokenRef.current = token;
    if (!token) return;
    tokenWaitersRef.current.forEach((resolve) => resolve(token));
    tokenWaitersRef.current = [];
  }

  /** The current captcha token, waiting briefly if the invisible check hasn't finished yet. */
  function takeToken(): Promise<string | null> {
    const ready = tokenRef.current
      ? Promise.resolve(tokenRef.current)
      : new Promise<string | null>((resolve) => {
          tokenWaitersRef.current.push(resolve);
          setTimeout(() => resolve(null), CAPTCHA_WAIT_MS);
        });
    return ready.then((token) => {
      // Single use: remount the widget so the next call gets a fresh one. Not on a timeout, which
      // would throw away a challenge the user may still be solving.
      if (token) {
        tokenRef.current = null;
        setCaptchaKey((key) => key + 1);
      }
      return token;
    });
  }

  /** Reads the uploaded file into profile fields. Null (with the error shown) when it can't. */
  async function parseUpload(upload: File): Promise<unknown | null> {
    if (parsedRef.current?.file === upload) return parsedRef.current.profile;

    const token = await takeToken();
    if (!token) {
      setError("We couldn't confirm you're not a bot. Please try again.");
      return null;
    }

    const formData = new FormData();
    formData.append("file", upload);
    formData.append("turnstileToken", token);
    const response = await fetch("/api/profile/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.profile) {
      setError(data ? data.error ?? "We couldn't read that file. Try another one, or start from scratch." : TIMED_OUT_MESSAGE);
      return null;
    }
    parsedRef.current = { file: upload, profile: data.profile };
    return data.profile;
  }

  /** Posts to a resume-creating route and opens the result. False when it failed (error shown). */
  async function createResume(url: string, body: object, openPath: (id: string) => string): Promise<boolean> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Null when the body isn't JSON, e.g. the platform's own page for a timed-out function.
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 403 && data?.code === "FREE_LIMIT_REACHED") {
        setLimitReached(true);
        setServerSaidExhausted(true);
        return false;
      }
      setError(data ? data.error ?? "Something went wrong. Please try again." : TIMED_OUT_MESSAGE);
      return false;
    }

    router.push(openPath(data.resume.id));
    return true;
  }

  async function executeCreate() {
    setError(null);
    setIsGenerating(true);

    try {
      let opened = false;
      const fromGeneration = (id: string) => `/resume/${id}?fromGeneration=1`;
      if (source === "scratch") {
        // A blank resume has nothing generated to announce; it opens with a how-to-fill-it hint instead.
        opened = await createResume("/api/resumes", {}, (id) => `/resume/${id}?blank=1`);
      } else if (source === "upload") {
        const importedProfile = file ? await parseUpload(file) : null;
        if (!file) {
          setError("Choose a file first.");
        } else if (!importedProfile) {
          // parseUpload has already shown why.
        } else if (!hasResumeContent(importedProfileToUserProfile(importedProfile, null, "").profile)) {
          // Caught here rather than by the server's same check, so it doesn't use up a generation.
          setError("We couldn't find any experience, education, skills or projects in that file. Try another one.");
        } else {
          opened = await createResume(
            "/api/generate-resume",
            { mode: "general", source: "upload", importedProfile },
            fromGeneration
          );
        }
      } else {
        // No template: the server starts every resume on the default, changed later in the editor.
        opened = await createResume("/api/generate-resume", { mode: "general" }, fromGeneration);
      }
      // On success isGenerating stays true: router.push isn't instant, and clearing it now would
      // drop the loading state while the editor page is still loading.
      if (!opened) setIsGenerating(false);
    } catch {
      setError(TIMED_OUT_MESSAGE);
      setIsGenerating(false);
    }
  }

  /** Runs the warn-only text check, then the sign-in check. False means "don't create (yet)". */
  async function isReadyToCreate(): Promise<boolean> {
    // Only the profile source writes from profile text, so only it gets the spelling check.
    if (source === "profile" && checkInput && !(await confirmTextCheck(checkInput))) return false;

    // Guests can reach this page; making a resume needs a free account. Once they've signed up
    // this resolves true and creation carries straight on.
    return requireAccount({
      title: "Create your free account to make your resume",
      subtitle: "Your resume starts straight after. It's free, and everything you've entered so far is kept.",
      submitLabel: "Create account & make my resume",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isBusy || resumeQuotaExhausted || submitBlocked) return;

    setError(null);
    // Set before any await so a second click can't start a second run while this one is pending.
    setIsPreparing(true);
    const isReady = await isReadyToCreate();
    setIsPreparing(false);
    if (isReady) await executeCreate();
  }

  function handleSourceChange(next: ResumeSource) {
    setError(null);
    onSourceChange(next);
  }

  const idleLabel =
    source === "upload" ? "Build from my resume" : source === "scratch" ? "Open a blank resume" : "Build my resume";
  const busyLabel = source === "scratch" ? "Opening editor…" : source === "upload" ? "Building your resume…" : "Drafting resume…";
  const buttonLabel = isGenerating ? busyLabel : isPreparing ? "Checking…" : error ? "Try again" : idleLabel;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7"
    >
      <LimitReachedModal
        isOpen={limitReached}
        onClose={() => setLimitReached(false)}
        title="You've used your free resumes"
        message={`You've used all ${limit} of your free resume generations. Upgrade for unlimited resumes, cover letters, and downloads.`}
      />

      {textCheckModal}

      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-semibold text-ink">A general resume</h2>
        <p className="text-sm text-ink-secondary">No job ad needed. Use it to apply widely, or as a starting point.</p>
      </div>

      <ResumeSourcePicker value={source} onChange={handleSourceChange} profileReady={profileReady} disabled={isBusy} />

      {/* One slot for the source's details and the progress panel, so the card doesn't jump; the
          progress stays up until the editor has loaded. A blank resume is quick, so it has none. */}
      <div className="flex flex-col">
        {isGenerating && source !== "scratch" ? (
          <GenerationProgress stages={source === "upload" ? UPLOAD_STAGES : DRAFTING_STAGES} intervalMs={5000}>
            <p className="border-t border-accent/20 pt-2 text-[11px] text-ink-muted">
              Written only from your {source === "upload" ? "file" : "profile"}. Your resume opens in the editor when
              it&apos;s ready.
            </p>
          </GenerationProgress>
        ) : source === "upload" ? (
          <div className="flex flex-col gap-2">
            <ResumeFileDrop
              file={file}
              onFileChange={(next) => {
                setError(null);
                setFile(next);
              }}
              disabled={isBusy}
            />
            <p className="text-[12.5px] text-ink-muted">
              Only what&apos;s in your file is used. Anything new in it is added to your profile, so you can tailor
              resumes later. Nothing already saved there changes.
            </p>
          </div>
        ) : (
          <PerkList perks={source === "scratch" ? SCRATCH_PERKS : PROFILE_PERKS} />
        )}

        {/* Outside the slot above, so it stays mounted while a click waits on it, and in the same
            gapless wrapper so the hidden widget adds no space. Hidden unless Cloudflare needs a
            click; remounted after each use (tokens are single-use). */}
        {source === "upload" && (
          <TurnstileWidget
            key={captchaKey}
            appearance="interaction-only"
            onVerify={handleToken}
            onExpire={() => handleToken(null)}
            onError={() => handleToken(null)}
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-critical">
          {error}
          {source === "upload" && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => handleSourceChange("scratch")}
                className="font-semibold text-accent-hover underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Start from scratch instead
              </button>
            </>
          )}
        </p>
      )}

      <div className="border-t border-border pt-5">
        {/* Out of free resumes: offer the one thing that helps instead of a button that can't work. */}
        {resumeQuotaExhausted && !isGenerating ? (
          <div className="flex flex-col gap-3 rounded-lg bg-paper-deep p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" aria-hidden="true" />
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  {limit === 1 ? "You've used your free resume" : `You've used your ${limit} free resumes`}
                </p>
                <p className="text-[13px] text-ink-secondary">Go Pro for unlimited resumes, cover letters and downloads.</p>
              </div>
            </div>
            <Button href="/upgrade" className="shrink-0 self-start sm:self-auto">
              Go Pro
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <Button type="submit" isLoading={isBusy} disabled={submitBlocked || isBusy}>
              {buttonLabel}
            </Button>
            {!isGenerating && (
              <>
                {source === "profile" && disabled && (
                  <p className="text-[13px] text-ink-secondary">
                    Fill in the profile details above first, or{" "}
                    <button
                      type="button"
                      onClick={() => handleSourceChange("upload")}
                      className="font-semibold text-accent-hover underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      upload a resume
                    </button>{" "}
                    instead.
                  </p>
                )}
                <QuotaIndicator isFreePlan={!isPaidPlan} remaining={remaining ?? 0} limit={limit} />
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

type Perk = { Icon: typeof ShieldCheckIcon; title: string; body: string };

function PerkList({ perks }: { perks: Perk[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {perks.map(({ Icon, title, body }) => (
        <li key={title} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-ink">{title}</p>
            <p className="text-[13px] leading-snug text-ink-muted">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const DRAFTING_STAGES = [
  "Reading your profile…",
  "Writing your summary…",
  "Writing your experience…",
  "Formatting your resume…",
];

const UPLOAD_STAGES = [
  "Reading your resume…",
  "Writing your summary…",
  "Writing your experience…",
  "Formatting your resume…",
];

const PROFILE_PERKS: Perk[] = [
  { Icon: ShieldCheckIcon, title: "Only your facts", body: "Written from your profile. Nothing made up." },
  { Icon: PaletteIcon, title: "Pick a design later", body: "Change the template in the editor." },
  { Icon: TargetIcon, title: "Tailor it any time", body: "Point it at a job ad when you find one." },
];

const SCRATCH_PERKS: Perk[] = [
  { Icon: UserIcon, title: "Contact details ready", body: "Filled in from your account and profile." },
  { Icon: PencilIcon, title: "Your words", body: "Add each section in the editor, your way." },
  { Icon: LayoutGridIcon, title: "Any design", body: "Switch templates whenever you like." },
];
