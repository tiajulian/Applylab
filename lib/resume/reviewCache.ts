import { resumeScoreHash } from "./resumeScoreHash";
import { sanitizeResumeContent } from "./sanitizeResumeContent";

// Bump when the rubric changes. Never reuse a score for a different job advertisement.
export const RESUME_REVIEW_VERSION = "review-v2";

export function resumeReviewHash(content: unknown, jobDescription = ""): string {
  return resumeScoreHash(sanitizeResumeContent(content), RESUME_REVIEW_VERSION, jobDescription.trim());
}
