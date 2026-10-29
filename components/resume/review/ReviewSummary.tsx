"use client";

import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Reveal } from "@/components/ui/Reveal";
import { scoreBand, scoreStyles } from "@/components/ui/scoreBands";
import { hasAssessedJobMatch, hasCurrentReviewRubric, hasFullContentReview } from "@/lib/resume/reviewAssessment";
import { REVIEW_CATEGORIES } from "./reviewCategories";
import type { ResumeReviewCategory } from "@/types";

interface ReviewSummaryProps {
  score: number;
  categories: ResumeReviewCategory[];
  openCount: number;
  scoredAt?: string;
  hasJobAd?: boolean;
  isStale?: boolean;
}

const VERDICT = { good: "Strong foundation", okay: "Room to improve", low: "Needs attention" } as const;

/** Quality and job match answer different questions. Unavailable checks never appear as zeroes. */
export function ReviewSummary({ score, categories, openCount, scoredAt, hasJobAd = false, isStale = false }: ReviewSummaryProps) {
  const currentRubric = hasCurrentReviewRubric(categories);
  const complete = currentRubric && hasFullContentReview(categories);
  const showQuality = complete && !isStale;
  const job = categories.find((c) => c.key === "job_optimization");
  const showMatch = Boolean(hasJobAd && complete && !isStale && hasAssessedJobMatch(categories) && job && job.max_points > 0);
  const jobScore = job ? Math.max(0, Math.min(100, Math.round(job.score / Math.max(1, job.max_points) * 100))) : 0;
  const tone = showQuality ? scoreStyles(score) : null;
  const qualityCategories = categories.filter((c) => c.key !== "job_optimization");

  return (
    <Reveal>
      <Card className="border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <div className={'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border ' + (tone ? tone.border + ' ' + tone.bg : 'border-border bg-paper-deep')}>
            <span className={'font-display text-2xl font-bold leading-none ' + (tone?.text ?? 'text-ink-muted')}>
              {showQuality ? <CountUp value={score} /> : <span aria-label="Not assessed">—</span>}
            </span>
            {showQuality && <span className="mt-0.5 text-[10px] text-ink-muted">/ 100</span>}
          </div>
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold text-ink">Resume quality</h2>
            <p className="mt-0.5 text-sm font-medium text-ink">
              {isStale || !currentRubric ? "Check again for an updated review" : complete ? VERDICT[scoreBand(score)] : "Basic checks completed"}
            </p>
            <p className="mt-1 text-sm text-ink-secondary">
              {isStale || !currentRubric ? "The resume, job ad or review checks have changed since this result."
                : complete ? (openCount ? "See the most useful improvements below." : "No open suggestions in this review.")
                : "The full analysis could not finish. Basic findings are available below; check again to retry."}
            </p>
            {scoredAt && <p className="mt-1 text-xs text-ink-muted">Checked {new Date(scoredAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}</p>}
          </div>
        </div>

        <details className="mt-4 border-t border-border pt-2">
          <summary className="min-h-11 cursor-pointer rounded-sm py-3 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">See quality breakdown</summary>
        <ul className="mt-2 flex flex-col gap-3">
          {qualityCategories.map((category) => {
            const assessed = currentRubric && !isStale && (complete || category.key === "ats_structure" || category.key === "application_readiness");
            const pct = category.max_points > 0 ? Math.min(100, Math.round(category.score / category.max_points * 100)) : 0;
            return (
              <li key={category.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <span className="min-w-0 text-sm text-ink" title={REVIEW_CATEGORIES[category.key].description}>{REVIEW_CATEGORIES[category.key].label}</span>
                <span className="text-right text-xs tabular-nums text-ink-secondary">{assessed ? category.score + "/" + category.max_points : "Not assessed"}</span>
                {assessed && <ProgressBar value={pct} className="col-span-2 h-1.5" barClassName={scoreStyles(pct).bar} />}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">Resume quality combines these four areas on a scale of 100.</p>
        </details>

        <div className="mt-5 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Match to this job</h3>
            <span className="text-sm font-semibold tabular-nums text-ink">{showMatch ? jobScore + "/100" : "Not assessed"}</span>
          </div>
          {showMatch && <ProgressBar value={jobScore} className="mt-2 h-1.5" barClassName={scoreStyles(jobScore).bar} />}
          <p className="mt-2 text-sm text-ink-secondary">
            {!hasJobAd ? "No job ad is attached. Your resume quality can still be reviewed."
              : isStale || !currentRubric ? "Check again to compare your current resume and job ad."
              : !showMatch ? "We couldn't finish the job comparison. Check again to retry."
              : "How your resume aligns with the attached job ad. This is separate from resume quality."}
          </p>
        </div>
        <p className="mt-4 text-xs text-ink-muted">ApplyLab guidance, not an employer&apos;s ATS score or a prediction of interview success. These checks do not verify the original file&apos;s layout.</p>
      </Card>
    </Reveal>
  );
}
