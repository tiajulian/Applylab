/**
 * Fixed verb list for the Win Builder's "What did you do?" step, deliberately ordered modest to
 * strong with no default selection - picking "supported" is exactly as easy as picking "led".
 * See build brief rule 2 (no pressure toward inflation). "Other" is always offered alongside this
 * list in the UI for a verb that isn't here, never a dead end.
 */
export const WIN_VERBS = [
  "supported",
  "assisted",
  "helped with",
  "coordinated",
  "organised",
  "maintained",
  "improved",
  "streamlined",
  "built",
  "created",
  "managed",
  "led",
] as const;

/**
 * Pickable outcome shapes for the Win Builder's "What changed?" step - recognition scaffolding
 * only (tap what rings true), never the claim itself. The candidate always still types the real
 * claim in their own words in the free-text field alongside these.
 */
export const WIN_OUTCOME_SHAPES = [
  "cut errors",
  "saved time",
  "made it easier",
  "kept people informed",
  "saved money",
] as const;

/**
 * Metric discovery prompts for the Win Builder's number step. Each helps the candidate recall a
 * real figure; tapping inserts a template with a blank, never a number.
 */
export const METRIC_PROMPTS = [
  { label: "Time saved", question: "How much time did it save, per week or per task?", template: "__ hours saved per week" },
  { label: "People", question: "How many people did it involve, train or serve?", template: "__ people" },
  { label: "Scale", question: "How many sites, customers, orders or projects?", template: "across __ " },
  { label: "Fewer errors", question: "Did mistakes, complaints or rework go down?", template: "__% fewer errors" },
  { label: "Money", question: "Did it save or bring in money?", template: "$__ saved" },
  { label: "Speed", question: "Did something get faster?", template: "__% faster" },
] as const;

export type MetricPrompt = (typeof METRIC_PROMPTS)[number];

/** The blank a metric template leaves for the candidate's own number. */
export const METRIC_BLANK = "__";

// The prompt most likely to jog a real number for each outcome picked in the step before.
const PROMPT_FOR_OUTCOME: Record<string, MetricPrompt["label"]> = {
  "saved time": "Time saved",
  "cut errors": "Fewer errors",
  "saved money": "Money",
  "kept people informed": "People",
};

/** METRIC_PROMPTS with the one matching the chosen outcome first; original order otherwise. */
export function orderMetricPrompts(outcome: string): readonly MetricPrompt[] {
  const first = PROMPT_FOR_OUTCOME[outcome.trim().toLowerCase()];
  if (!first) return METRIC_PROMPTS;
  return [...METRIC_PROMPTS].sort((a, b) => Number(b.label === first) - Number(a.label === first));
}
