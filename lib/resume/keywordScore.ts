import { sanitizeResumeContent } from "./sanitizeResumeContent";
import type { ContentScoreBreakdown } from "@/types";

/** Browser-safe identity for the exact content assessed. Layout order does not affect a score. */
export function keywordContentKey(content: unknown): string {
  const { section_order: _order, ...scorable } = sanitizeResumeContent(content);
  return JSON.stringify(scorable);
}

export function isKeywordScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isContentScoreBreakdown(value: unknown): value is ContentScoreBreakdown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const scores = value as Record<string, unknown>;
  return ["impact", "clarity", "brevity", "completeness"].every((key) => isKeywordScore(scores[key]));
}
