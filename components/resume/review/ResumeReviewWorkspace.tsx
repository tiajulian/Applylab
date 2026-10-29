"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewHighlights } from "./ReviewHighlights";
import { ReviewSkillGapPanel } from "./ReviewSkillGapPanel";
import { ReviewCareerGuidance } from "./ReviewCareerGuidance";
import type { ReviewSkillGap } from "@/lib/resume/reviewSkillGap";
import { FindingsPanel, isOpenFinding } from "./FindingsPanel";
import { ReviewScoringLoader } from "./ReviewScoringLoader";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { TargetIcon } from "./icons";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import type {
  Resume,
  ResumeContent,
  ResumeReviewFinding,
  ResumeReviewResult,
} from "@/types";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { refreshFreeUsage } from "@/lib/hooks/useFreeUsesLeft";
import { REVIEW_CATEGORY_LABELS, TIMINGS } from "@/lib/marketing/copy";
import { findingField, type ActionableFinding, type ReviewAction } from "@/lib/resume/reviewActions";
import { hasCurrentReviewRubric, hasFullContentReview } from "@/lib/resume/reviewAssessment";

interface ResumeReviewWorkspaceProps {
  skillGap?: ReviewSkillGap | null;
  resume: Resume;
  initialReview: ResumeReviewResult | null;
  isPaidPlan: boolean;
  isStaleInitially: boolean;
}

export function ResumeReviewWorkspace({
  resume,
  initialReview,
  isPaidPlan,
  isStaleInitially,
  skillGap,
}: ResumeReviewWorkspaceProps) {
  const [review, setReview] = useState<ResumeReviewResult | null>(initialReview);
  const [currentResume, setCurrentResume] = useState<ResumeContent | null>(resume.resume_content);
  const [jobDescription, setJobDescription] = useState(resume.job_description ?? "");
  const [skillContext, setSkillContext] = useState(skillGap ?? null);
  const [isStale, setIsStale] = useState<boolean>(isStaleInitially);
  const [isScoring, setIsScoring] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState<boolean>(true);
  const [applyingFindingId, setApplyingFindingId] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const operationPending = useRef(false);
  const [notice, setNotice] = useState("");
  const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set());
  const hasDrafts = draftIds.size > 0;
  const handleDraftChange = useCallback((findingId: string, dirty: boolean) => {
    setDraftIds((previous) => {
      if (previous.has(findingId) === dirty) return previous;
      const next = new Set(previous);
      if (dirty) next.add(findingId); else next.delete(findingId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!hasDrafts) return;
    const preventLostDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLostDraft);
    return () => window.removeEventListener("beforeunload", preventLostDraft);
  }, [hasDrafts]);

  async function handleRunReview() {
    if (operationPending.current || hasDrafts) return;
    operationPending.current = true;
    setError(null);
    setNotice("");
    setLimitReached(false);
    setIsScoring(true);

    try {
      const response = await fetch(`/api/resume/${resume.id}/review`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      refreshFreeUsage();

      if (!response.ok) {
        if (data.code === "FREE_LIMIT_REACHED") {
          setLimitReached(true);
          return;
        }
        setError(data.error ?? "Failed to complete resume review. Please try again.");
        return;
      }

      if (!data.review || !Array.isArray(data.review.categories) || !Array.isArray(data.review.findings)) {
        setError("We couldn't read the review result. Please try again.");
        return;
      }
      setReview(data.review);
      if (data.resumeContent) setCurrentResume(data.resumeContent);
      if (typeof data.jobDescription === "string") setJobDescription(data.jobDescription);
      setIsStale(false);
      setNotice(hasFullContentReview(data.review.categories) ? "Your review is ready." : "Basic checks are ready. The full review is unavailable; you can try again.");
    } catch {
      setError("Network request failed or timed out. Please try again.");
    } finally {
      operationPending.current = false;
      setIsScoring(false);
    }
  }

  async function handleReviewAction(finding: ResumeReviewFinding, action: ReviewAction, fixText?: string, expectedText?: string) {
    if (operationPending.current) throw new Error("Please wait for the current change to finish saving.");
    const changesText = action === "apply" || (action === "undo" && finding.status === "applied");
    if (changesText && currentResume) {
      const blockId = action === "undo" ? (finding as ActionableFinding).review_change?.blockId : findingField(currentResume, finding)?.id;
      const overlapsDraft = review?.findings.some((other) => other.id !== finding.id && draftIds.has(other.id)
        && findingField(currentResume, other)?.id === blockId);
      if (overlapsDraft) throw new Error("You have unsaved wording for this same text in another suggestion. Apply it or choose Keep mine there first.");
    }
    operationPending.current = true;
    setApplyingFindingId(finding.id);
    setNotice("");

    try {
      const response = await fetch(`/api/resume/${resume.id}/review/apply-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: finding.id,
          action,
          fixText,
          expectedText,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? "We couldn't save this change. Please try again.");
      }
      if (!data.resume?.resume_content || !Array.isArray(data.findings)) {
        throw new Error("We couldn't confirm the save. Your draft is still here. Refresh the page to check your resume.");
      }

      if (data.resume?.resume_content) {
        setCurrentResume(data.resume.resume_content);
      }
      if (typeof data.resume.job_description === "string") setJobDescription(data.resume.job_description);

      if (data.findings) {
        setReview((previous) => previous ? { ...previous, findings: data.findings } : previous);
      }
      if (typeof data.isStale === "boolean") setIsStale(data.isStale);
      else if (action !== "dismiss" && !(action === "undo" && finding.status === "dismissed")) setIsStale(true);
      setNotice(action === "apply" ? "Change saved. You can undo it in the suggestion below."
        : action === "dismiss" ? "Kept your wording. You can undo this choice in the suggestion below." : "Your change has been undone.");
    } catch (cause) {
      // The card owns the error so its draft stays visible and can be retried.
      if (cause instanceof TypeError) throw new Error("Couldn't reach ApplyLab. Your draft is still here. Check your connection and try again.");
      throw cause instanceof Error ? cause : new Error("We couldn't save this change. Please try again.");
    } finally {
      operationPending.current = false;
      setApplyingFindingId(null);
    }
  }

  const TemplateComponent = getTemplateDefinition(resume.template ?? "ats-safe").component;

  return (
    <div className="flex flex-col gap-6" onClickCapture={(event) => {
      if (hasDrafts && event.target instanceof Element && event.target.closest("a[href]")
        && !window.confirm("You have unsaved answers or wording. Leave this page and discard them?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }}>
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/resume/${resume.id}`}>
            <Button type="button" variant="ghost" size="sm" className="text-ink-secondary">
              <ArrowLeftIcon className="mr-1 inline h-4 w-4 align-text-bottom" /> Back to editor
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <span className="text-[12.5px] font-medium text-ink-secondary">Resume check</span>
            <h1 className="font-display text-lg font-bold text-ink">
              {resume.job_title || "General resume"}
              {resume.company_name && (
                <span className="font-normal text-ink-muted"> • {resume.company_name}</span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPdf((prev) => !prev)}
            className="hidden sm:inline-flex"
          >
            {showPdf ? "Hide preview" : "Show preview"}
          </Button>

          {/* When stale, the banner below carries "Check again" instead. */}
          {review && !isStale && (
            <Button
              type="button"
              size="sm"
              onClick={handleRunReview}
              disabled={applyingFindingId !== null || hasDrafts}
              isLoading={isScoring}
              variant="outline"
            >
              Check again
              <FreeUsesLeft feature="resume-review" />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-critical/30 bg-critical-soft/50 p-4 text-sm text-critical">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <Button type="button" variant="ghost" size="sm" onClick={handleRunReview}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      <p role="status" aria-live="polite" className={notice ? "text-sm text-ink-secondary" : "sr-only"}>{notice}</p>
      {hasDrafts && <p className="text-sm text-ink-secondary">You have unsaved answers or wording below. Save or cancel your answers, and apply your wording or choose Keep mine before checking again.</p>}

      {review && isStale && !isScoring && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-attention/30 bg-attention-soft/50 px-4 py-3 text-sm text-ink">
          <span>The resume, job ad or review checks have changed. Check again for an updated result.</span>
          <Button type="button" size="sm" onClick={handleRunReview} disabled={applyingFindingId !== null || hasDrafts}>
            Check again
            <FreeUsesLeft feature="resume-review" />
          </Button>
        </div>
      )}

      {/* Main Review Workspace Layout */}
      {isScoring ? (
        <ReviewScoringLoader />
      ) : !review ? (
        // Not Run State
        <Reveal>
          <Card className="flex flex-col items-center justify-center gap-6 border border-border bg-surface p-12 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent shadow-inner">
              <TargetIcon className="h-7 w-7" />
            </div>

            <div className="flex max-w-lg flex-col gap-2">
              <h2 className="font-display text-h2 font-bold text-ink">
                How good is this resume?
              </h2>
              <p className="text-[15px] leading-relaxed text-ink-secondary">
                Check your resume quality, see the most useful improvements, and compare it with an attached job ad.
              </p>
              <ul className="mx-auto mt-2 flex flex-col gap-1.5 text-left text-[14px] text-ink">
                {Object.values(REVIEW_CATEGORY_LABELS).map((label) => (
                  <li key={label} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <Button type="button" size="lg" onClick={handleRunReview} className="shadow-pop">
              Check my resume
              <FreeUsesLeft feature="resume-review" />
            </Button>

            <p className="text-[13.5px] text-ink-muted">Takes about {TIMINGS.resumeScoreSeconds} seconds. Nothing on your resume changes until you approve it.</p>
          </Card>
        </Reveal>
      ) : (
        // Scored State (Ready / Locked / Unlocked / Stale)
        <div className={`grid gap-6 ${showPdf ? "lg:grid-cols-12" : "max-w-4xl mx-auto w-full"}`}>
          {/* Left Rail: Live PDF Document Preview */}
          {showPdf && currentResume && (
            <div className="order-last lg:order-none lg:col-span-5 lg:sticky lg:top-6 lg:self-start">
              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-sm">
                <TemplateComponent
                  resume={currentResume}
                  density={{ ...DEFAULT_DENSITY, fontPt: resume.font_size_pt ?? 10 }}
                />
              </div>
            </div>
          )}

          {/* Right Rail: Diagnostic Scoring & Findings */}
          <div className={`${showPdf ? "lg:col-span-7" : "w-full"} flex flex-col gap-6`}>
            {hasCurrentReviewRubric(review.categories) && currentResume && <ReviewHighlights content={currentResume} findings={review.findings} unlocked={review.unlocked} onSelect={(findingId) => {
              const trigger = document.getElementById(`finding-trigger-${findingId}`);
              if (!trigger) return;
              if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
              trigger.scrollIntoView({ block: "center" });
              trigger.focus({ preventScroll: true });
            }} />}

            <ReviewSummary
              score={review.overall_score}
              categories={review.categories}
              openCount={review.findings.filter(isOpenFinding).length}
              scoredAt={review.scored_at}
              hasJobAd={Boolean(jobDescription.trim())}
              isStale={isStale}
            />

            <ReviewCareerGuidance />
            {skillContext && currentResume && jobDescription === (resume.job_description ?? "") && <ReviewSkillGapPanel
              context={skillContext} content={currentResume} onDraftChange={handleDraftChange} onChange={(updated) => setSkillContext((previous) => previous ? {
                ...previous, items: previous.items.map((item) => item.id === updated.id ? updated : item),
              } : previous)} />}

            {hasCurrentReviewRubric(review.categories) ? <FindingsPanel
              findings={review.findings}
              content={currentResume}
              resumeId={resume.id}
              unlocked={review.unlocked}
              onAction={handleReviewAction}
              applyingFindingId={applyingFindingId}
              onDraftChange={handleDraftChange}
              skillGap={jobDescription === (resume.job_description ?? "") ? skillContext : null}
            /> : <Card density="content" className="text-sm text-ink-secondary">Run the updated review to get current suggestions. Your saved resume has not been changed.</Card>}
          </div>
        </div>
      )}

      <LimitReachedModal
        isOpen={limitReached}
        onClose={() => setLimitReached(false)}
        title="You've used your free resume scores"
        message="Go Pro for unlimited resume scores."
      />
    </div>
  );
}
