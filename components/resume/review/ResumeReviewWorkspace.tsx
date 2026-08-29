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
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import type {
  Resume,
  ResumeContent,
  ResumeReviewCategoryKey,
  ResumeReviewFinding,
  ResumeReviewResult,
} from "@/types";

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

  async function handleRunReview() {
    setError(null);
    setIsScoring(true);

    try {
      const response = await fetch(`/api/resume/${resume.id}/review`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
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
              ← Back to editor
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                AI Resume Diagnostic
              </span>
              {review && (
                <Badge
                  variant={isStale ? "attention" : "neutral"}
                  className="text-[10px]"
                >
                  {isStale ? "Stale" : "Ready"}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-lg font-bold text-ink">
              {resume.job_title || "Untitled Resume"}
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

          <Button
            type="button"
            size="sm"
            onClick={handleRunReview}
            isLoading={isScoring}
            variant={isStale || !review ? "primary" : "outline"}
          >
            {!review ? "Score resume" : isStale ? "Re-run review" : "Re-score"}
          </Button>
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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-2xl text-accent shadow-inner">
              🎯
            </div>

            <div className="flex max-w-lg flex-col gap-2">
              <h2 className="font-display text-h2 font-bold text-ink">
                Comprehensive AI Resume Review
              </h2>
              <p className="text-sm leading-relaxed text-ink-secondary">
                Consolidates your resume against 5 core recruiter criteria: <strong>ATS &amp; structure</strong>, <strong>Content impact</strong>, <strong>Writing quality</strong>, <strong>Job tailoring</strong>, and <strong>Application readiness</strong>.
              </p>
            </div>

            <Button type="button" size="lg" onClick={handleRunReview} className="shadow-pop">
              Score resume now (Free)
            </Button>

            <div className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-2 pt-4">
              <div className="rounded-lg border border-border/80 bg-paper-deep/50 p-3">
                <span className="text-xs font-semibold text-ink">0–100 Overall &amp; Category Scores</span>
                <p className="text-[11px] text-ink-muted mt-0.5">Free diagnostic scores across all 5 pillars</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-paper-deep/50 p-3">
                <span className="text-xs font-semibold text-ink">Actionable Findings &amp; 1-Click Fixes</span>
                <p className="text-[11px] text-ink-muted mt-0.5">Gated reasoning and bullet rewrite suggestions</p>
              </div>
            </div>
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
                  Scoring Pillars (Sum = {review.overall_score}/100)
                </h3>
                <span className="text-xs text-ink-muted">
                  Click to filter findings
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
    </div>
  );
}
