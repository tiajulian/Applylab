import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AiProvider } from "@/lib/anthropic/models";

// USD per million tokens — keep in sync with the models wired up in lib/anthropic/models.ts.
const ANTHROPIC_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

// Verified 2026-08-28 against OpenAI's own pricing page (developers.openai.com/api/docs/pricing,
// standard tier). gpt-5.6-luna was missing entirely until this fix — every skills-bridge call
// (which runs on every resume generation, see MODEL_BY_FEATURE below) fell through the `if
// (!pricing) return 0` guard in estimateCostUsd and logged $0, undercounting real spend on the
// admin dashboard.
const OPENAI_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
};

// Keyed to the actual model IDs in lib/gemini/client.ts (gemini-3.6-flash / -3.5-flash-lite,
// substituted live during implementation after 2.5-flash/-flash-lite 404'd as retired - see the
// comment there). Verified 2026-08-26 against Google's own pricing page
// (https://ai.google.dev/gemini-api/docs/pricing, paid/standard tier, direct Gemini API - not
// Vertex/Enterprise) - the previous figures here were stale 2.5-series numbers never updated for
// the 3.x rename and were undercounting real spend by ~5.5x.
// gemini-3.6-flash is promotional pricing through 2026-12-31; standard pricing (double: $1.50 /
// $7.50) takes effect 2027-01-01 - bump this when that lands.
const GEMINI_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
};

// Cache write/read costs are multiples of the base input price (see
// https://platform.claude.com/docs/en/build-with-claude/prompt-caching): a 5-minute-TTL cache
// write costs 1.25x, a cache read costs 0.1x. We only ever request the default (5m) TTL, so a
// single write multiplier is enough here. OpenAI/Gemini calls in this app don't use prompt
// caching, so these multipliers only ever apply to the Anthropic branch below.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

function estimateCostUsd(
  provider: AiProvider,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationInputTokens: number,
  cacheReadInputTokens: number
): number {
  if (provider === "anthropic") {
    const pricing = ANTHROPIC_PRICING_PER_MILLION_TOKENS[model];
    if (!pricing) return 0;
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (cacheCreationInputTokens / 1_000_000) * pricing.input * CACHE_WRITE_MULTIPLIER +
      (cacheReadInputTokens / 1_000_000) * pricing.input * CACHE_READ_MULTIPLIER +
      (outputTokens / 1_000_000) * pricing.output
    );
  }

  const pricingTable =
    provider === "openai" ? OPENAI_PRICING_PER_MILLION_TOKENS : GEMINI_PRICING_PER_MILLION_TOKENS;
  const pricing = pricingTable[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export interface LogApiCostInput {
  userId: string;
  feature: string;
  provider: AiProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens written to the prompt cache this call (billed at ~1.25x input price). Omitted/0 when caching isn't used. */
  cacheCreationInputTokens?: number;
  /** Tokens served from the prompt cache this call (billed at ~0.1x input price). Zero across repeated calls means the cache isn't hitting — see shared/prompt-caching.md. */
  cacheReadInputTokens?: number;
}

/**
 * Records one AI API call's token usage and estimated cost, across whichever provider handled
 * it. Best-effort and never throws — a logging failure must never break the feature that
 * triggered the call. Writes via the service-role client since api_cost_log has no
 * client-facing RLS policies at all (see supabase/schema.sql) — only this helper and the admin
 * routes ever touch it.
 */
export async function logApiCost(input: LogApiCostInput): Promise<void> {
  try {
    const cacheCreationInputTokens = input.cacheCreationInputTokens ?? 0;
    const cacheReadInputTokens = input.cacheReadInputTokens ?? 0;
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("api_cost_log").insert({
      user_id: input.userId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      cache_creation_input_tokens: cacheCreationInputTokens,
      cache_read_input_tokens: cacheReadInputTokens,
      estimated_cost_usd: estimateCostUsd(
        input.provider,
        input.model,
        input.inputTokens,
        input.outputTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens
      ),
    });
    if (error) {
      console.error("logApiCost: insert failed", error);
    }
  } catch (error) {
    console.error("logApiCost: unexpected error", error);
  }
}
