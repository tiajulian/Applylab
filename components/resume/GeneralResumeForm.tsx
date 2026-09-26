"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SignupAtGenerateModal } from "@/components/auth/SignupAtGenerateModal";
import { TemplateBar } from "@/components/resume/TemplateBar";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { createClient } from "@/lib/supabase/client";
import { usePreGenerateCheck } from "@/lib/hooks/usePreGenerateCheck";
import type { CheckInput } from "@/lib/text/preGenerateCheck";
import type { CanonicalTemplate } from "@/types";

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
  const [selectedTemplate, setSelectedTemplate] = useState<CanonicalTemplate>("clean");
  const [isGenerating, setIsGenerating] = useState(false);
  // True from the click until generation starts or is abandoned (spell check, sign-in check).
  const [isPreparing, setIsPreparing] = useState(false);
  const { confirm: confirmTextCheck, modal: textCheckModal } = usePreGenerateCheck();
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [candidateFullName, setCandidateFullName] = useState("");

  // Same free-quota gate as the tailored flow: stays visually disabled but not natively `disabled`,
  // so the tap still reaches handleSubmit and surfaces the limit modal instead of being swallowed.
  const resumeQuotaExhausted = !isPaidPlan && remaining !== null && remaining <= 0;

  async function executeGenerateResume() {
    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "general", template: selectedTemplate }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsGenerating(false);
        if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
          setLimitReached(true);
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

    // Anonymous users can reach this page, but generating requires a permanent account.
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (user?.is_anonymous) {
        setCandidateFullName(user.user_metadata?.full_name ?? "");
        setShowSignupModal(true);
        return false;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    }
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPreparing || isGenerating) return;

    if (resumeQuotaExhausted) {
      setLimitReached(true);
      return;
    }

    setError(null);
    // Set before any await so a second click can't start a second run while this one is pending.
    setIsPreparing(true);
    const isReady = await isReadyToGenerate();
    setIsPreparing(false);
    if (isReady) await executeGenerateResume();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded border border-border bg-surface p-6">
      <SignupAtGenerateModal
        isOpen={showSignupModal}
        defaultFullName={candidateFullName}
        onClose={() => setShowSignupModal(false)}
        onSuccess={() => {
          setShowSignupModal(false);
          executeGenerateResume();
        }}
      />

      <LimitReachedModal
        isOpen={limitReached}
        onClose={() => setLimitReached(false)}
        title="You've used your free resumes"
        message={`You've used all ${limit} of your free resume generations. Upgrade for unlimited resumes, cover letters, and downloads.`}
      />

      {textCheckModal}

      <TemplateBar selectedTemplate={selectedTemplate} onSelect={setSelectedTemplate} />

      <p className="text-sm text-ink-secondary">
        We&apos;ll build your resume from your profile, using only what you&apos;ve told us. You can tailor it to a
        specific job ad later.
      </p>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex flex-col items-start gap-3">
        <Button
          type="submit"
          isLoading={isGenerating || isPreparing}
          disabled={resumeQuotaExhausted ? isGenerating : disabled || isGenerating || isPreparing}
          className={resumeQuotaExhausted ? "self-start opacity-50 hover:-translate-y-0 active:translate-y-0" : "self-start"}
        >
          {isGenerating ? "Drafting resume…" : isPreparing ? "Checking your text…" : error ? "Try again" : "Build my resume"}
        </Button>
        {!isGenerating && <QuotaIndicator isFreePlan={!isPaidPlan} remaining={remaining ?? 0} limit={limit} />}
        {resumeQuotaExhausted && !isGenerating ? (
          <p className="text-sm text-ink-secondary">
            You&apos;ve used all {limit} of your free resume generations.{" "}
            <Link href="/upgrade" className="font-medium text-accent hover:underline">
              Upgrade
            </Link>{" "}
            for unlimited resumes.
          </p>
        ) : (
          disabled &&
          !isGenerating && (
            <p className="text-sm text-ink-secondary">Finish the required profile fields above to generate.</p>
          )
        )}
      </div>
    </form>
  );
}
