"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { SkillsBridgeReview } from "@/components/resume/SkillsBridgeReview";
import type { SkillsBridge, SkillsBridgeItem } from "@/types";

const JOB_AD_PARSE_DEBOUNCE_MS = 600;
const MIN_JOB_AD_LENGTH_TO_PARSE = 20;

function HowThisWorksLink() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent-hover hover:underline"
        onClick={() => setIsOpen((open) => !open)}
      >
        How does this work?
      </button>
      {isOpen && (
        <div className="absolute left-0 z-10 mt-2 w-72 rounded border border-border bg-surface p-4 text-sm text-ink-secondary shadow-pop">
          We compare your work history to what this job is asking for and show you where they genuinely line
          up. Anything we&apos;re not sure about, we ask you to confirm first, we never add a skill or
          achievement you haven&apos;t told us about.
          <button
            type="button"
            className="mt-3 block text-xs font-medium text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink-secondary"
            onClick={() => setIsOpen(false)}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

export function ResumeForm({
  disabled = false,
  isPaidPlan,
  remaining,
  limit,
}: {
  disabled?: boolean;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
}) {
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Two separate error states: `adError` is specifically about the job-ad field (tied to the
  // textarea's red-border affordance), `error` is a generic form-level failure (a 500, a
  // timeout, etc.) that has nothing to do with what's in the ad text — conflating the two would
  // visually blame the textarea for problems that aren't about its content.
  const [adError, setAdError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once /api/skills-bridge returns - switches the form over to the bridge review step.
  // Quota (resumes_used) isn't touched by reaching this state; that only happens once the user
  // clicks "Build resume from this bridge" inside SkillsBridgeReview.
  const [bridgeState, setBridgeState] = useState<{ bridge: SkillsBridge; items: SkillsBridgeItem[] } | null>(null);

  // Refs, not state: read at debounce-fire time so a field the user has since edited by hand
  // never gets silently overwritten by a slow-arriving auto-fill response, without needing this
  // to trigger re-renders (nothing in the UI reflects "touched" status).
  const titleTouchedRef = useRef(false);
  const companyTouchedRef = useRef(false);
  const lastParsedAdRef = useRef("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  async function runJobAdParse(adText: string) {
    const trimmed = adText.trim();
    if (trimmed.length < MIN_JOB_AD_LENGTH_TO_PARSE || trimmed === lastParsedAdRef.current) return;
    lastParsedAdRef.current = trimmed;

    const response = await fetch("/api/parse-job-ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adText: trimmed }),
    });

    // Graceful failure by design: a timeout, error, or rate-limit here just means the fields
    // stay as they are — never a blocking or scary error, since this is a non-metered autofill
    // helper, not part of generation itself.
    if (!response.ok) return;

    const data = await response.json().catch(() => null);
    if (!data) return;

    if (!titleTouchedRef.current && typeof data.title === "string" && data.title) {
      setJobTitle(data.title);
    }
    if (!companyTouchedRef.current && typeof data.company === "string" && data.company) {
      setCompanyName(data.company);
    }
  }

  function scheduleJobAdParse(adText: string) {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void runJobAdParse(adText);
    }, JOB_AD_PARSE_DEBOUNCE_MS);
  }

  function handleJobDescriptionPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    // The paste event fires before the browser applies the pasted text to .value, so reading
    // it synchronously here would see the pre-paste content — defer to the next tick.
    const target = event.target as HTMLTextAreaElement;
    setTimeout(() => scheduleJobAdParse(target.value), 0);
  }

  function handleJobDescriptionBlur(event: React.FocusEvent<HTMLTextAreaElement>) {
    scheduleJobAdParse(event.target.value);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAdError(null);

    if (!jobDescription.trim()) {
      setAdError("Paste the job ad to continue");
      return;
    }

    setIsAnalyzing(true);

    // Wrapped in try/catch/finally: a network failure, or a non-JSON response (e.g. a platform
    // timeout page, which isn't JSON), used to throw out of an unguarded response.json() call
    // here and leave isAnalyzing stuck true forever — the button would spin indefinitely with no
    // error ever shown. This call is un-metered (see app/api/skills-bridge/route.ts), so unlike
    // generation there's no quota concern here, only the request itself resolving cleanly.
    try {
      const response = await fetch("/api/skills-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, companyName, jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setBridgeState({ bridge: data.bridge, items: data.items });
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (bridgeState) {
    return (
      <SkillsBridgeReview
        bridge={bridgeState.bridge}
        initialItems={bridgeState.items}
        jobTitle={jobTitle}
        companyName={companyName}
        jobDescription={jobDescription}
        isPaidPlan={isPaidPlan}
        remaining={remaining}
        limit={limit}
        onBack={() => setBridgeState(null)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor="jobDescription" className="text-sm font-medium text-ink-secondary">
            Job ad
          </label>
          <span className="rounded-pill bg-paper-deep px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-secondary">
            Required
          </span>
        </div>
        <Textarea
          id="jobDescription"
          placeholder="Paste the full job ad from SEEK here. We'll read the role and company automatically."
          className="min-h-[150px]"
          rows={10}
          value={jobDescription}
          onChange={(e) => {
            setJobDescription(e.target.value);
            if (adError) setAdError(null);
          }}
          onPaste={handleJobDescriptionPaste}
          onBlur={handleJobDescriptionBlur}
          error={adError ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-ink-muted">Pulled from the ad. Edit if we got it wrong.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="jobTitle"
            label="Job title"
            placeholder="e.g. Business Analyst"
            value={jobTitle}
            onChange={(e) => {
              titleTouchedRef.current = true;
              setJobTitle(e.target.value);
            }}
          />
          <Input
            id="companyName"
            label="Company"
            placeholder="e.g. Woolworths Group"
            value={companyName}
            onChange={(e) => {
              companyTouchedRef.current = true;
              setCompanyName(e.target.value);
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex flex-col items-start gap-3">
        {!isAnalyzing && (
          <p className="text-sm text-ink-secondary">
            Next, we&apos;ll show how your past experience matches this job, so your resume speaks their
            language. Takes about 20 seconds.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isAnalyzing} disabled={disabled} className="self-start">
            See how I match this job
          </Button>
          {!isAnalyzing && <HowThisWorksLink />}
        </div>
        {!isAnalyzing && !isPaidPlan && remaining !== null && (
          <p className="text-xs text-ink-muted">{remaining} of {limit} free generations left</p>
        )}
        {disabled && !isAnalyzing && (
          <p className="text-sm text-ink-secondary">Finish the required profile fields above to generate.</p>
        )}
      </div>
    </form>
  );
}
