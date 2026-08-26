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
  // skills-bridge stays on Sonnet - do not "optimize" this onto Haiku or a cheaper provider. It's
  // a reasoning-heavy differentiator (mapping real experience onto a target role, especially
  // pivot/gap judgement calls) and a 7-model side-by-side comparison confirmed this isn't just
  // caution: both Gemini models and GPT-5.6 Terra marked a genuine skill gap (no PM-tool
  // experience) as merely "unconfirmed" instead of absent, and over-credited a stretch mapping
  // with unwarranted high confidence - Sonnet 4.6/5 and Haiku 4.5 all held the line correctly.
  // See skillsBridge.ts and docs/interview-review.md-style reasoning (recorded in conversation,
  // not yet a doc) for the comparison.
  "skills-bridge": { provider: "anthropic", model: CLAUDE_MODEL },

  // generate-resume moved to Gemini Flash: on the same comparison, once a correct skills-bridge
  // mapping is handed to it (the judgement call above already made), every model - including the
  // ones that were too generous doing that judgement themselves - correctly respected an explicit
  // "these are gaps, don't claim them" instruction with zero fabrication. So the resume-writing
  // step's honesty guarantee is inherited from skills-bridge, not independently at risk here.
  // Gemini Flash won a separate quality/cost comparison on a simple case (cheapest of 7 models
  // tested, and the only one that got bullet-count budgets exactly right on both roles) with no
  // fabrication issues on the harder pivot case either. Sonnet 5 was tested and rejected for this
  // slot: on the harder case it spent its entire output budget on internal reasoning and returned
  // no usable resume at all, while also being the most expensive of all 7 models in real terms on
  // the simpler case - not a viable "cheaper newer version," a functional regression.
  "generate-resume": { provider: "gemini", model: GEMINI_MODEL_FLASH },

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
  // same as text there, unlike OpenAI's audio-capable tiers), but on Flash-Lite rather than
  // Flash: a 6-scenario side-by-side (docs/interview-review.md) found Flash-Lite at least as
  // good and, on the one test that matters most - a fabricated/exaggerated answer - clearly
  // better: Flash scored the fabrication highly and even recycled the invented figures into its
  // own "exemplary" suggested answer, while Flash-Lite caught it and named it as embellishment.
  // Cheaper too (~40-60% less per call). question-gen/report-gen are pure text-to-text and moved
  // to OpenAI's gpt-4o-mini + strict JSON schema - ~5-6x cheaper per call for that job. See
  // lib/gemini/generateInterviewQuestions.ts for the full rationale.
  "interview-question-gen": { provider: "openai", model: OPENAI_MODEL_MINI },
  "interview-answer-score": { provider: "gemini", model: GEMINI_MODEL_FLASH_LITE },
  "interview-report-gen": { provider: "openai", model: OPENAI_MODEL_MINI },
} as const satisfies Record<string, FeatureModel>;

export type ModelFeature = keyof typeof MODEL_BY_FEATURE;

/**
 * OPTIONAL, OFF BY DEFAULT, AND CURRENTLY STALE: this predates generate-resume's move to Gemini
 * Flash. Flipping it on today would make resolveResumeModel() return a Claude model ID
 * (CLAUDE_MODEL_FAST) while generateResume.ts calls the Gemini client - a real bug, not just an
 * untested path. Would need generateResume.ts to route by provider (like the interview-answer
 * routes do) before this is safe to enable again. Originally: when enabled, resume generation
 * used Haiku for free-plan users and kept the premium model for Pro/Lifetime, to cut cost on the
 * tier that doesn't pay.
 */
export const FREE_TIER_RESUME_ON_HAIKU = false;

/**
 * Resolves the model for one resume-generation call. With FREE_TIER_RESUME_ON_HAIKU false (the
 * default), this always returns MODEL_BY_FEATURE["generate-resume"].model regardless of plan -
 * flipping the flag is the only thing that changes this function's behaviour (see the flag's own
 * doc comment for why flipping it is currently broken).
 */
export function resolveResumeModel(plan: Plan): string {
  if (FREE_TIER_RESUME_ON_HAIKU && plan === "free") {
    return CLAUDE_MODEL_FAST;
  }
  return MODEL_BY_FEATURE["generate-resume"].model;
}
