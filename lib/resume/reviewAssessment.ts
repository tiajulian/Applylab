import type { ResumeReviewCategory } from "@/types";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

export function hasReviewJobFacts(job: CompactJobAd | null): boolean {
  return Boolean(job && [job.must_have_skills, job.nice_to_have_skills, job.tools, job.key_responsibilities, job.keywords]
    .some((items) => items?.some((item) => item.trim())));
}

/** Document quality is independent of which job a person applies for. */
export function reviewQualityScore(categories: ResumeReviewCategory[]): number {
  const quality = categories.filter((c) => c.key !== "job_optimization");
  const possible = quality.reduce((sum, c) => sum + c.max_points, 0);
  return possible > 0 ? Math.max(0, Math.min(100, Math.round(quality.reduce((sum, c) => sum + c.score, 0) / possible * 100))) : 0;
}

export function hasCurrentReviewRubric(categories: ResumeReviewCategory[]): boolean {
  return categories.length === 5 && categories.every((c) => c.assessment !== undefined);
}

export function hasFullContentReview(categories: ResumeReviewCategory[]): boolean {
  return ["content_quality", "writing_quality"].every((key) => categories.find((c) => c.key === key)?.assessment === "ai");
}

export function hasAssessedJobMatch(categories: ResumeReviewCategory[]): boolean {
  return categories.find((c) => c.key === "job_optimization")?.assessment === "ai";
}

export function canReuseReview(categories: ResumeReviewCategory[], hasJobAd: boolean): boolean {
  return hasCurrentReviewRubric(categories) && hasFullContentReview(categories) && (!hasJobAd || hasAssessedJobMatch(categories));
}
