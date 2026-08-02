import { CLAUDE_MODEL, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import type { Plan } from "@/types";

/**
 * Single source of truth for which model each Claude-calling feature uses. Keyed by the same
 * `feature` string each call site already passes to logApiCost, so the model a feature runs on
 * and the model recorded in the cost log can never drift apart. To move a feature to a different
 * model, edit its entry here — nothing else at the call site needs to change.
 */
export const MODEL_BY_FEATURE = {
  // Quality-critical generative writing - stays on Sonnet. Do not "optimize" these onto Haiku:
  // generate-resume IS the product (writing quality is what people pay for), and skills-bridge
  // is a reasoning-heavy differentiator where Haiku produces shallower, less trustworthy skill
  // mappings. See generateResume.ts and skillsBridge.ts for the full rationale.
  "generate-resume": CLAUDE_MODEL,
  "skills-bridge": CLAUDE_MODEL,

  // Formulaic writing, a small single-bullet edit the user reviews, or reshaping an
  // already-good resume rather than writing from scratch - Haiku is sufficient here.
  "generate-cover-letter": CLAUDE_MODEL_FAST,
  assist: CLAUDE_MODEL_FAST,
  "duplicate-retailor": CLAUDE_MODEL_FAST,

  // Structured extraction/classification - already verified at Haiku quality (see client.ts).
  "parse-job-ad": CLAUDE_MODEL_FAST,
  "profile-parse": CLAUDE_MODEL_FAST,
  "ats-score": CLAUDE_MODEL_FAST,
  "content-score": CLAUDE_MODEL_FAST,
  "role-duties": CLAUDE_MODEL_FAST,
} as const;

export type ModelFeature = keyof typeof MODEL_BY_FEATURE;

/**
 * OPTIONAL, OFF BY DEFAULT. When enabled, resume generation uses Haiku for free-plan users and
 * keeps Sonnet for Pro/Lifetime, to cut cost on the tier that doesn't pay. Leave this `false`
 * until Haiku resume quality has been reviewed side-by-side with Sonnet - it directly affects the
 * product's core output, not a support/utility call. Flipping it only ever affects free-plan
 * users; Pro/Lifetime always get MODEL_BY_FEATURE["generate-resume"] (Sonnet) either way.
 */
export const FREE_TIER_RESUME_ON_HAIKU = false;

/**
 * Resolves the model for one resume-generation call. With FREE_TIER_RESUME_ON_HAIKU false (the
 * default), this always returns MODEL_BY_FEATURE["generate-resume"] regardless of plan - flipping
 * the flag is the only thing that changes this function's behaviour.
 */
export function resolveResumeModel(plan: Plan): string {
  if (FREE_TIER_RESUME_ON_HAIKU && plan === "free") {
    return CLAUDE_MODEL_FAST;
  }
  return MODEL_BY_FEATURE["generate-resume"];
}
