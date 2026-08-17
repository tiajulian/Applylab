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
