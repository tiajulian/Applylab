// One set of thresholds for every score badge and score bar (scores out of 100). Change them here only.
export const SCORE_THRESHOLDS = { good: 80, okay: 60 } as const;

export type ScoreBand = "good" | "okay" | "low";

export function scoreBand(score: number): ScoreBand {
  if (score >= SCORE_THRESHOLDS.good) return "good";
  if (score >= SCORE_THRESHOLDS.okay) return "okay";
  return "low";
}

// Status colours: for showing a score only, never for buttons or links (those are brand).
// Each text colour reaches at least 4.5:1 on its own soft background.
const SCORE_BAND_STYLES: Record<ScoreBand, { text: string; bg: string; border: string; bar: string }> = {
  good: { text: "text-success", bg: "bg-success-soft", border: "border-success/30", bar: "bg-success" },
  okay: { text: "text-attention", bg: "bg-attention-soft", border: "border-attention/30", bar: "bg-attention" },
  low: { text: "text-critical", bg: "bg-critical-soft", border: "border-critical/30", bar: "bg-critical" },
};

export function scoreStyles(score: number) {
  return SCORE_BAND_STYLES[scoreBand(score)];
}
