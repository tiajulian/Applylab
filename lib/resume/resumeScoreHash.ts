import { hashForScoring } from "@/lib/resume/scoreCache";

/**
 * The score-cache hash of a resume's content, after any `leading` parts (e.g. the job ad). Section
 * order is layout, not content, so reordering sections never makes a score stale (and never spends
 * a re-score). Every score reader and writer must hash through here so their hashes agree.
 */
export function resumeScoreHash(content: unknown, ...leading: string[]): string {
  const { section_order: _layoutOnly, ...rest } = (content ?? {}) as Record<string, unknown>;
  return hashForScoring(...leading, JSON.stringify(rest));
}
