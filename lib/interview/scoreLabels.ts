import type { StarScores } from "@/types";

export type ScoreTone = "critical" | "attention" | "success-soft" | "success";

export interface ScoreLabel {
  label: string;
  tone: ScoreTone;
}

/** Retries allowed after feedback on one question (so 3 tries in all). */
export const MAX_RETRIES_PER_TURN = 2;

/** Section 8.5: always shown next to the number, never the number alone. */
export function scoreLabel(average: number): ScoreLabel {
  if (average < 2.5) return { label: "Needs work", tone: "critical" };
  if (average < 3.5) return { label: "Getting there", tone: "attention" };
  if (average <= 4.2) return { label: "Interview-ready", tone: "success-soft" };
  return { label: "Strong", tone: "success" };
}

/** Tailwind classes for a label chip. */
export const SCORE_TONE_CLASSES: Record<ScoreTone, string> = {
  critical: "bg-critical-soft text-ink",
  attention: "bg-attention-soft text-ink",
  "success-soft": "bg-success-soft text-ink",
  success: "bg-success text-on-accent",
};

/** Mean of the four STAR parts, to one decimal. */
export function starAverage(star: Pick<StarScores, "situation" | "task" | "action" | "result">): number {
  return Math.round(((star.situation + star.task + star.action + star.result) / 4) * 10) / 10;
}

/** interview_sessions.overall_score is stored 0-100 (STAR total / 20 x 100); shown on the 1-5 scale. */
export function overallToFive(overall: number): number {
  return Math.round((overall / 20) * 10) / 10;
}

export const STAR_PARTS = ["situation", "task", "action", "result"] as const;

export const STAR_PART_LABELS: Record<(typeof STAR_PARTS)[number], string> = {
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
};

/** Any part at 2 or below: the answer is worth another try before moving on. */
export function hasWeakPart(star: StarScores | null | undefined): boolean {
  return Boolean(star && STAR_PARTS.some((p) => star[p] <= 2));
}
