import { COVER_LETTER_FEATURES, COVER_LETTER_LIMITS, type CoverLetterFeature } from "@/lib/coverLetter/config";
import type { Plan } from "@/types";

export function canUseFeature(plan: Plan, feature: CoverLetterFeature): boolean {
  return (COVER_LETTER_FEATURES[feature] as readonly Plan[]).includes(plan);
}

/** Letters a plan may still create: null means unlimited. */
export function remainingLetters(plan: Plan, activeLetters: number): number | null {
  if (plan !== "free") return null;
  return Math.max(0, COVER_LETTER_LIMITS.freeLetters - activeLetters);
}

export function canCreateLetter(plan: Plan, activeLetters: number): boolean {
  const remaining = remainingLetters(plan, activeLetters);
  return remaining === null || remaining > 0;
}

export function lockedFeatures(plan: Plan): CoverLetterFeature[] {
  return (Object.keys(COVER_LETTER_FEATURES) as CoverLetterFeature[]).filter((f) => !canUseFeature(plan, f));
}
