"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { SkillsBridgeReview } from "@/components/resume/SkillsBridgeReview";
import { GenerationStepper } from "@/components/resume/GenerationStepper";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { CANONICAL_TEMPLATE_LIST } from "@/lib/resume/templateMetadata";
import { useJobAdAutofill } from "@/lib/hooks/useJobAdAutofill";
import { useProgressStage } from "@/lib/hooks/useProgressMessages";
import { trackFunnelEvent } from "@/lib/analytics";
import type { CanonicalTemplate, ProjectEntry, SkillsBridge, SkillsBridgeItem } from "@/types";


const MATCHING_STAGES = [
  "Parsing job ad requirements & SEEK keywords…",
  "Evaluating core competencies & must-haves…",
  "Cross-referencing your verified career profile…",
  "Synthesizing your personalized skills bridge…",
];

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
  const [selectedTemplate, setSelectedTemplate] = useState<CanonicalTemplate>("clean");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Two separate error states: `adError` is specifically about the job-ad field (tied to the
  // textarea's red-border affordance), `error` is a generic form-level failure (a 500, a
  // timeout, etc.) that has nothing to do with what's in the ad text — conflating the two would
  // visually blame the textarea for problems that aren't about its content.
  const [adError, setAdError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once /api/skills-bridge returns - switches the form over to the bridge review step.
  // Quota (resumes_used) isn't touched by reaching this state; that only happens once the user
  // clicks "Build resume from this bridge" inside SkillsBridgeReview.
  const [bridgeState, setBridgeState] = useState<{
    bridge: SkillsBridge;
    items: SkillsBridgeItem[];
    roles?: Array<{ company: string; job_title: string }>;
    projects?: ProjectEntry[];
  } | null>(null);

  const { currentStage, stageIndex, progressPct } = useProgressStage(MATCHING_STAGES, isAnalyzing, 2400);

  const { titleTouchedRef, companyTouchedRef, handleJobDescriptionPaste, handleJobDescriptionBlur } =
    useJobAdAutofill({ setJobTitle, setCompanyName });

  const activeTemplateMeta = CANONICAL_TEMPLATE_LIST.find((t) => t.id === selectedTemplate) ?? CANONICAL_TEMPLATE_LIST[0];

  function handleOpenTemplateModal() {
    trackFunnelEvent("template_picker_shown", { source: "creation_form", currentTemplate: selectedTemplate });
    setShowTemplateModal(true);
  }

  function handleSelectTemplate(next: CanonicalTemplate) {
    trackFunnelEvent("template_selected", { templateId: next, source: "creation_form" });
    setSelectedTemplate(next);
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
        body: JSON.stringify({ jobTitle, companyName, jobDescription, turnstileToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTurnstileToken(null);
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setBridgeState({
        bridge: data.bridge,
        items: data.items,
        roles: data.roles ?? [],
        projects: data.projects ?? [],
      });
    } catch {
      setTurnstileToken(null);
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (bridgeState) {
    return (
      <div className="flex flex-col gap-4">
        <GenerationStepper currentStep={2} />
        <SkillsBridgeReview
          bridge={bridgeState.bridge}
          initialItems={bridgeState.items}
          roles={bridgeState.roles ?? []}
          jobTitle={jobTitle}
          companyName={companyName}
          jobDescription={jobDescription}
          template={selectedTemplate}
          isPaidPlan={isPaidPlan}
          remaining={remaining}
          limit={limit}
          onBack={() => setBridgeState(null)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded border border-border bg-surface p-6">
      <GenerationStepper currentStep={1} />

      {/* Template picker entry bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/80 bg-paper/60 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Template:</span>
          <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
            {activeTemplateMeta.name}
            {activeTemplateMeta.isRecommended && (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                Recommended
              </span>
            )}
          </span>
          <span className="hidden sm:inline text-xs text-ink-muted">· {activeTemplateMeta.voice}</span>
        </div>
        <button
          type="button"
          onClick={handleOpenTemplateModal}
          className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Change template →
        </button>
      </div>

      <ChooseTemplateModal
        isOpen={showTemplateModal}
        selectedTemplate={selectedTemplate}
        onSelect={handleSelectTemplate}
        onClose={() => setShowTemplateModal(false)}
      />

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

      {isAnalyzing && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent-soft/40 p-4 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm font-semibold text-ink">{currentStage}</span>
            </div>
            <span className="text-xs font-semibold text-accent tabular-nums">{progressPct}%</span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="grid gap-1.5 pt-1 text-xs sm:grid-cols-2">
            {MATCHING_STAGES.map((stage, idx) => (
              <div
                key={stage}
                className={`flex items-center gap-1.5 transition-colors ${
                  idx < stageIndex
                    ? "font-medium text-success"
                    : idx === stageIndex
                    ? "font-semibold text-accent"
                    : "text-ink-muted"
                }`}
              >
                <span>{idx < stageIndex ? "✓" : idx === stageIndex ? "▸" : "○"}</span>
                <span className="truncate">{stage.replace(/…/g, "")}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted">
            Matching strictly against your verified profile. We never invent experience you haven&apos;t shared.
          </p>
        </div>
      )}

      <div className="flex flex-col items-start gap-3">
        {!isAnalyzing && (
          <p className="text-sm text-ink-secondary">
            Next, we&apos;ll show how your past experience matches this job, so your resume speaks their
            language. Takes about 20 seconds.
          </p>
        )}
        {!isAnalyzing && (
          <TurnstileWidget
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
            className="my-1"
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            isLoading={isAnalyzing}
            disabled={disabled || isAnalyzing || !turnstileToken}
            className="self-start"
          >
            {isAnalyzing ? "Analyzing job fit…" : "See how I match this job"}
          </Button>
          {!isAnalyzing && <HowThisWorksLink />}
        </div>
        {!isAnalyzing && (
          <QuotaIndicator isFreePlan={!isPaidPlan} remaining={remaining ?? 0} limit={limit} />
        )}
        {disabled && !isAnalyzing && (
          <p className="text-sm text-ink-secondary">Finish the required profile fields above to generate.</p>
        )}
      </div>
    </form>
  );
}
