"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { ScoreSummaryCard } from "./ScoreSummaryCard";
import { CategoryScoreRow } from "./CategoryScoreRow";
import { FindingsPanel } from "./FindingsPanel";
import { ReviewScoringLoader } from "./ReviewScoringLoader";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { TargetIcon } from "./icons";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import type {
  Resume,
  ResumeContent,
  ResumeReviewCategoryKey,
  ResumeReviewFinding,
  ResumeReviewResult,
} from "@/types";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { refreshFreeUsage } from "@/lib/hooks/useFreeUsesLeft";
import { REVIEW_CATEGORY_LABELS, TIMINGS } from "@/lib/marketing/copy";

interface ResumeReviewWorkspaceProps {
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
}: ResumeReviewWorkspaceProps) {
  const router = useRouter();

  const [review, setReview] = useState<ResumeReviewResult | null>(initialReview);
  const [currentResume, setCurrentResume] = useState<ResumeContent | null>(resume.resume_content);
  const [isStale, setIsStale] = useState<boolean>(isStaleInitially);
  const [isScoring, setIsScoring] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<ResumeReviewCategoryKey | "all">("all");
  const [applyingFindingId, setApplyingFindingId] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function handleRunReview() {
    setError(null);
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

      setReview(data.review);
      setIsStale(false);
    } catch {
      setError("Network request failed or timed out. Please try again.");
    } finally {
      setIsScoring(false);
    }
  }

  async function handleApplyFix(finding: ResumeReviewFinding) {
    if (!finding.fix_text) return;
    setApplyingFindingId(finding.id);
    setError(null);

    try {
      const response = await fetch(`/api/resume/${resume.id}/review/apply-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId: finding.id,
          fixText: finding.fix_text,
          target: finding.target,
          bulletText: finding.bullet_text,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Failed to apply fix to resume");
        return;
      }

      if (data.resume?.resume_content) {
        setCurrentResume(data.resume.resume_content);
      }

      if (review && data.findings) {
        setReview({
          ...review,
          findings: data.findings,
        });
      }
      setIsStale(true);
    } catch {
      setError("Failed to apply fix. Please check your network connection.");
    } finally {
      setApplyingFindingId(null);
    }
  }

  const TemplateComponent = getTemplateDefinition(resume.template ?? "ats-safe").component;

  return (
    <div className="flex flex-col gap-6">
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
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-medium text-ink-secondary">Check &amp; improve</span>
              {review && (
                <Badge
                  variant={isStale ? "attention" : "neutral"}
                  className="text-[10px]"
                >
                  {isStale ? "Out of date" : "Up to date"}
                </Badge>
              )}
            </div>
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
            {showPdf ? "Hide PDF" : "Show PDF"}
          </Button>

          {review && (
            <Button
              type="button"
              size="sm"
              onClick={handleRunReview}
              isLoading={isScoring}
              variant={isStale ? "primary" : "outline"}
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
                ApplyLab scores it out of 100 across 5 areas, then shows exactly what to fix.
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
            <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
              <div className="flex items-center justify-between px-1 text-xs text-ink-muted">
                <span className="font-medium">Live Document Preview</span>
                <span className="rounded bg-paper-deep px-2 py-0.5 font-mono text-[10px]">
                  {getTemplateDefinition(resume.template).name}
                </span>
              </div>

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
            {/* Score Summary Card */}
            <ScoreSummaryCard
              score={review.overall_score}
              totalFindings={review.findings.length}
              isStale={isStale}
              unlocked={review.unlocked}
              scoredAt={review.scored_at}
            />

            {/* Category Breakdown list (5 fixed rows) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Score areas
                </h3>
                <span className="text-xs text-ink-muted">
                  Tap an area to filter what to fix
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {review.categories.map((category) => (
                  <CategoryScoreRow
                    key={category.key}
                    category={category}
                    isSelected={selectedCategory === category.key}
                    onClick={() =>
                      setSelectedCategory((prev) => (prev === category.key ? "all" : category.key))
                    }
                  />
                ))}
              </div>
            </div>

            {/* Findings & Fixes Panel */}
            <FindingsPanel
              findings={review.findings}
              unlocked={review.unlocked}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onApplyFix={handleApplyFix}
              applyingFindingId={applyingFindingId}
            />
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
