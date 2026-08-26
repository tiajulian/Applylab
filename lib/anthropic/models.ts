import { CLAUDE_MODEL, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { OPENAI_MODEL_MINI } from "@/lib/openai/models";
import { GEMINI_MODEL_FLASH, GEMINI_MODEL_FLASH_LITE } from "@/lib/gemini/models";
import type { Plan } from "@/types";

export type AiProvider = "anthropic" | "openai" | "gemini";

export interface FeatureModel {
  provider: AiProvider;
  model: string;
}

/**
 * Single source of truth for which provider+model each AI-calling feature uses. Keyed by the
 * same `feature` string each call site already passes to logApiCost. Every call site reads its
 * model string from here (MODEL_BY_FEATURE[FEATURE].model) rather than hardcoding it, so the
 * model actually used and the model recorded in the cost log can never drift apart. To move a
 * feature to a different provider, edit its entry here AND update that feature's call site to
 * use the matching client instance (still a manual step - lib/anthropic/lib/openai/lib/gemini
 * have entirely different SDK call shapes, so which client to call can't be data-driven).
 *
 * This file imports only the side-effect-free lib/{provider}/models.ts model-ID constants, never
 * lib/{provider}/client.ts (which constructs that provider's client at module load and throws if
 * its API key is unset) - every AI-calling feature in the app imports MODEL_BY_FEATURE, so
 * importing a client here would mean one missing key breaks every feature, not just the ones
 * that use that provider.
 */
export const MODEL_BY_FEATURE = {
  // Quality-critical generative writing - stays on Sonnet. Do not "optimize" these onto Haiku
  // or a cheaper provider: generate-resume IS the product (writing quality is what people pay
  // for), and skills-bridge is a reasoning-heavy differentiator where a shallower model produces
  // less trustworthy skill mappings. See generateResume.ts and skillsBridge.ts for the full
  // rationale.
  "generate-resume": { provider: "anthropic", model: CLAUDE_MODEL },
  "skills-bridge": { provider: "anthropic", model: CLAUDE_MODEL },

  // Formulaic writing, a small single-bullet edit the user reviews, or reshaping an
  // already-good resume rather than writing from scratch - still on Claude Haiku for now.
  "generate-cover-letter": { provider: "anthropic", model: CLAUDE_MODEL_FAST },
  "duplicate-retailor": { provider: "anthropic", model: CLAUDE_MODEL_FAST },

  // Structured extraction/classification - moved to OpenAI gpt-4o-mini with strict JSON schema
  // (native schema-level validation instead of markdown-fenced JSON parsing).
  "parse-job-ad": { provider: "openai", model: OPENAI_MODEL_MINI },
  "profile-parse": { provider: "openai", model: OPENAI_MODEL_MINI },
  "ats-score": { provider: "openai", model: OPENAI_MODEL_MINI },

  // Still on Claude Haiku - not part of the utility-endpoint migration batch.
  "content-score": { provider: "anthropic", model: CLAUDE_MODEL_FAST },
  "role-duties": { provider: "anthropic", model: CLAUDE_MODEL_FAST },
  "score-resume-combined": { provider: "anthropic", model: CLAUDE_MODEL_FAST },

  // Low-latency interactive UI helpers - moved to Gemini Flash / Flash-Lite.
  assist: { provider: "gemini", model: GEMINI_MODEL_FLASH },
  copilot: { provider: "gemini", model: GEMINI_MODEL_FLASH },
  "win-starters": { provider: "gemini", model: GEMINI_MODEL_FLASH_LITE },

  // Recruiter-grade P-A-C-E project enhancement
  "project-enhance": { provider: "anthropic", model: CLAUDE_MODEL },

  // AI Interview Prep features. answer-score stays on Gemini for native audio input (priced the
  // same as text there, unlike OpenAI's audio-capable tiers); question-gen/report-gen are pure
  // text-to-text and moved to OpenAI's gpt-4o-mini + strict JSON schema - ~5-6x cheaper per call
  // for this job. See lib/gemini/generateInterviewQuestions.ts for the full rationale.
  "interview-question-gen": { provider: "openai", model: OPENAI_MODEL_MINI },
  "interview-answer-score": { provider: "gemini", model: GEMINI_MODEL_FLASH },
  "interview-report-gen": { provider: "openai", model: OPENAI_MODEL_MINI },
} as const satisfies Record<string, FeatureModel>;

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
 * default), this always returns MODEL_BY_FEATURE["generate-resume"].model regardless of plan -
 * flipping the flag is the only thing that changes this function's behaviour.
 */
export function resolveResumeModel(plan: Plan): string {
  if (FREE_TIER_RESUME_ON_HAIKU && plan === "free") {
    return CLAUDE_MODEL_FAST;
  }
  return MODEL_BY_FEATURE["generate-resume"].model;
}
