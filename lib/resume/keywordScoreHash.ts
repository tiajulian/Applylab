import { resumeScoreHash } from "./resumeScoreHash";
import { sanitizeResumeContent } from "./sanitizeResumeContent";

/** Old permissive assessments must be checked again, never trusted as validated results. */
export function keywordScoreHash(content: unknown, jobAd: string): string {
  return resumeScoreHash(sanitizeResumeContent(content), "keyword-v2", jobAd);
}
