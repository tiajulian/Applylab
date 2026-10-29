import { describe, expect, it } from "vitest";
import { canReuseReview, hasAssessedJobMatch, hasFullContentReview, hasReviewJobFacts, reviewQualityScore } from "./reviewAssessment";
import { resumeReviewHash } from "./reviewCache";
import type { ResumeReviewCategory, ResumeReviewCategoryKey } from "@/types";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import { sanitizeResumeContent } from "./sanitizeResumeContent";

const keys: ResumeReviewCategoryKey[] = ["ats_structure", "content_quality", "writing_quality", "application_readiness", "job_optimization"];
const max = [20, 30, 20, 15, 15];
const categories: ResumeReviewCategory[] = keys.map((key, i) => ({ key, label: key, score: max[i], max_points: max[i], finding_count: 0, locked: false, assessment: i === 1 || i === 2 || i === 4 ? "ai" : "basic" }));

describe("review assessment and caching", () => {
  it("keeps quality independent of job match", () => {
    expect(reviewQualityScore(categories)).toBe(100);
    expect(reviewQualityScore(categories.map((c) => c.key === "job_optimization" ? { ...c, score: 0 } : c))).toBe(100);
  });
  it("does not call a basic or legacy review complete", () => {
    expect(hasFullContentReview(categories)).toBe(true);
    expect(canReuseReview(categories, true)).toBe(true);
    expect(canReuseReview(categories.map((c) => ({ ...c, assessment: "basic" })), false)).toBe(false);
    expect(canReuseReview(categories.map(({ assessment: _assessment, ...c }) => c), false)).toBe(false);
  });
  it("does not cache a failed job comparison when an ad is present", () => {
    const incomplete = categories.map((c) => c.key === "job_optimization" ? { ...c, assessment: "not_assessed" as const, score: 0 } : c);
    expect(hasAssessedJobMatch(incomplete)).toBe(false);
    expect(canReuseReview(incomplete, true)).toBe(false);
    expect(canReuseReview(incomplete, false)).toBe(true);
  });
  it("changes the review hash when the job ad changes, but not when sections are reordered", () => {
    const content = { summary: "Reports", section_order: ["summary", "skills"] };
    expect(resumeReviewHash(content, "Job A")).not.toBe(resumeReviewHash(content, "Job B"));
    expect(resumeReviewHash(content, " Job A ")).toBe(resumeReviewHash(content, "Job A"));
    expect(resumeReviewHash(content, "Job A")).toBe(resumeReviewHash({ ...content, section_order: ["skills", "summary"] }, "Job A"));
    expect(resumeReviewHash(content)).toBe(resumeReviewHash(sanitizeResumeContent(content)));
  });
  it("requires actual job requirements before reporting a job match", () => {
    expect(hasReviewJobFacts(null)).toBe(false);
    expect(hasReviewJobFacts({ title: "Analyst" } as CompactJobAd)).toBe(false);
    expect(hasReviewJobFacts({ must_have_skills: ["SQL"] } as CompactJobAd)).toBe(true);
  });
});
