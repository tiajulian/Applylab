"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { LockIcon, PaletteIcon, ShieldCheckIcon, TargetIcon } from "@/components/ui/icons/LucideIcons";
import { useAccountGate } from "@/components/auth/AccountGate";
import { GenerationProgress } from "@/components/resume/GenerationProgress";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { usePreGenerateCheck } from "@/lib/hooks/usePreGenerateCheck";
import type { CheckInput } from "@/lib/text/preGenerateCheck";

/**
 * The no-job-ad path: builds a resume straight from the user's profile. It skips the skills bridge
 * (which only exists to map experience onto a specific job ad) and goes directly to
 * /api/generate-resume with mode "general".
 */
export function GeneralResumeForm({
  disabled = false,
  isPaidPlan,
  remaining,
  limit,
  checkInput,
}: {
  disabled?: boolean;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
  /** Profile text to spell/grammar-check before generating; no check when omitted. */
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

  // Out of free resumes: the submit button is replaced by the Go Pro panel below.
  const resumeQuotaExhausted = serverSaidExhausted || (!isPaidPlan && remaining !== null && remaining <= 0);

  async function executeGenerateResume() {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No template: the server starts every resume on the default, changed later in the editor.
        body: JSON.stringify({ mode: "general" }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsGenerating(false);
        if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
          setLimitReached(true);
          setServerSaidExhausted(true);
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // Leave isGenerating true: router.push isn't instant, and clearing it now would drop the
      // loading state while the editor page is still loading.
      router.push(`/resume/${data.resume.id}?fromGeneration=1`);
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
      setIsGenerating(false);
    }
  }

  /** Runs the warn-only text check, then the sign-in check. False means "don't generate (yet)". */
  async function isReadyToGenerate(): Promise<boolean> {
    if (checkInput && !(await confirmTextCheck(checkInput))) return false;

    // Guests can reach this page; making a resume needs a free account. Once they've signed up
    // this resolves true and generation carries straight on.
    return requireAccount({
      title: "Create your free account to make your resume",
      subtitle: "Your resume starts straight after. It's free, and everything you've entered so far is kept.",
      submitLabel: "Create account & make my resume",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPreparing || isGenerating || resumeQuotaExhausted) return;

    setError(null);
    // Set before any await so a second click can't start a second run while this one is pending.
    setIsPreparing(true);
    const isReady = await isReadyToGenerate();
    setIsPreparing(false);
    if (isReady) await executeGenerateResume();
  }

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
        <h2 className="text-[16px] font-semibold text-ink">A resume from your profile</h2>
        <p className="text-sm text-ink-secondary">No job ad needed. Use it to apply widely, or as a starting point.</p>
      </div>

      {/* Same slot as the perks, so the card doesn't jump; stays up until the editor has loaded. */}
      {isGenerating ? (
        <GenerationProgress stages={DRAFTING_STAGES} intervalMs={5000}>
          <p className="border-t border-accent/20 pt-2 text-[11px] text-ink-muted">
            Written only from your profile. Your resume opens in the editor when it&apos;s ready.
          </p>
        </GenerationProgress>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {PERKS.map(({ Icon, title, body }) => (
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
      )}

      {error && <p className="text-sm text-critical">{error}</p>}

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
            <Button type="submit" isLoading={isGenerating || isPreparing} disabled={disabled || isGenerating || isPreparing}>
              {isGenerating ? "Drafting resume…" : isPreparing ? "Checking your text…" : error ? "Try again" : "Build my resume"}
            </Button>
            {!isGenerating && (
              <>
                {disabled && <p className="text-[13px] text-ink-secondary">Fill in the profile details above first.</p>}
                <QuotaIndicator isFreePlan={!isPaidPlan} remaining={remaining ?? 0} limit={limit} />
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}

const DRAFTING_STAGES = [
  "Reading your profile…",
  "Writing your summary…",
  "Writing your experience…",
  "Formatting your resume…",
];

const PERKS = [
  { Icon: ShieldCheckIcon, title: "Only your facts", body: "Written from your profile. Nothing made up." },
  { Icon: PaletteIcon, title: "Pick a design later", body: "Change the template in the editor." },
  { Icon: TargetIcon, title: "Tailor it any time", body: "Point it at a job ad when you find one." },
];
