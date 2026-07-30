import { createServiceRoleClient } from "@/lib/supabase/server";

// USD per million tokens — keep in sync with the models wired up in lib/anthropic/client.ts.
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export interface LogApiCostInput {
  userId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Records one Claude API call's token usage and estimated cost. Best-effort and never throws —
 * a logging failure must never break the feature that triggered the call. Writes via the
 * service-role client since api_cost_log has no client-facing RLS policies at all (see
 * supabase/schema.sql) — only this helper and the admin routes ever touch it.
 */
export async function logApiCost(input: LogApiCostInput): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("api_cost_log").insert({
      user_id: input.userId,
      feature: input.feature,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      estimated_cost_usd: estimateCostUsd(input.model, input.inputTokens, input.outputTokens),
    });
    if (error) {
      console.error("logApiCost: insert failed", error);
    }
  } catch (error) {
    console.error("logApiCost: unexpected error", error);
  }
}
