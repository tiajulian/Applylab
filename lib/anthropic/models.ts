import { CLAUDE_MODEL, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { OPENAI_MODEL_MINI, OPENAI_MODEL_LUNA } from "@/lib/openai/models";
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
  // skills-bridge moved to GPT-5.6 Luna (~1/40th Sonnet's price). A 7-model comparison first found
  // Gemini (both tiers) and GPT-5.6 Terra too generous on the actual skill-gap judgement call
  // (marking a genuine gap - no PM-tool experience - as merely "unconfirmed" instead of absent,
  // and over-crediting a stretch mapping with unwarranted high confidence). Luna was the one
  // model that held the line correctly there despite being the cheapest of all 7. A follow-up
  // 4-scenario comparison against Sonnet specifically (pivot, level-up, rich-evidence,
  // thin-evidence) found Luna matching Sonnet's core honesty judgement in every case, with no
  // fabrication-risk error in any of them - on the thin-evidence case it was arguably *more*
  // disciplined, sticking closer to the job ad's literal stated requirements than Sonnet did.
  // Do not casually "optimize" this further onto Gemini or GPT-5.6 Terra - both were specifically
  // tested and rejected here for the fabrication-adjacent failure this feature exists to prevent.
  "skills-bridge": { provider: "openai", model: OPENAI_MODEL_LUNA },

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

  // Moved to GPT-5.6 Luna 2026-08-28 after a live side-by-side against Haiku on the exact
  // production system prompt (not a generic benchmark): no dash-rule or fabrication violations
  // in the candidate's output across cover-letter/retailor/followup-draft/role-duties, and on
  // duplicate-retailor Luna was actually cleaner than Haiku - Haiku added an unsupported claim
  // ("establishing patterns adopted across the product") to a bullet that Luna left faithful to
  // the source resume. ~70% cheaper per call than Haiku on measured token counts from that
  // comparison.
  "generate-cover-letter": { provider: "openai", model: OPENAI_MODEL_LUNA },
  "duplicate-retailor": { provider: "openai", model: OPENAI_MODEL_LUNA },
  "followup_draft": { provider: "openai", model: OPENAI_MODEL_LUNA },
  "role-duties": { provider: "openai", model: OPENAI_MODEL_LUNA },

  // Structured extraction/classification - moved to OpenAI gpt-4o-mini with strict JSON schema
  // (native schema-level validation instead of markdown-fenced JSON parsing).
  "parse-job-ad": { provider: "openai", model: OPENAI_MODEL_MINI },
  "profile-parse": { provider: "openai", model: OPENAI_MODEL_MINI },
  "ats-score": { provider: "openai", model: OPENAI_MODEL_MINI },

  // content-score and score-resume-combined stay on Claude Haiku deliberately - the same
  // 2026-08-28 comparison found real regressions here, not just wording differences. Both
  // candidates (GPT-5.6 Luna, Gemini 3.5 Flash-Lite) returned only 1 weak-bullet issue where the
  // prompt allows "up to 3" (Haiku returned 3), and score-resume-combined's ATS score swung hard
  // on an identical resume/job pair (Haiku 92, Luna 78, Gemini 75) - candidates score
  // responsibility-phrase wording more strictly as "missing keywords" than Haiku does. Moving
  // either would silently shift every user's score, not just change wording - needs a deliberate
  // prompt re-tune and re-baseline first, not a drop-in swap.
  "content-score": { provider: "anthropic", model: CLAUDE_MODEL_FAST },
  "score-resume-combined": { provider: "anthropic", model: CLAUDE_MODEL_FAST },
  "score-review": { provider: "anthropic", model: CLAUDE_MODEL_FAST },

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
