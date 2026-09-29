import { openai } from "@/lib/openai/client";
import { EMBEDDING_DIMENSIONS, OPENAI_EMBEDDING_MODEL } from "@/lib/openai/models";
import { estimateCostUsd, logApiCost } from "@/lib/anthropic/costLog";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { assertAiAvailable, recordAiCommit, recordAiReserve } from "@/lib/aiGateway/breakerGuard";
import { callGateway } from "@/lib/aiGateway/gateway";
import type { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types";

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

const USER_FEATURE = "job-profile-embed" as const;

function createEmbeddings(input: string[]) {
  return openai.embeddings.create({ model: OPENAI_EMBEDDING_MODEL, input, dimensions: EMBEDDING_DIMENSIONS });
}

/**
 * Embeds text for system work that has no user behind it (the daily job ingestion), so there is
 * no per-user credit ledger to reserve against. It still sits behind the AI circuit breaker and
 * feeds the breaker's spend velocity.
 */
export const embedSystemTexts: EmbedFn = async (texts) => {
  if (texts.length === 0) return [];
  await assertAiAvailable();
  await recordAiReserve(0);

  const response = await createEmbeddings(texts);

  const costUsd = estimateCostUsd("openai", OPENAI_EMBEDDING_MODEL, response.usage.prompt_tokens, 0, 0, 0);
  await recordAiCommit(0, costUsd);

  return [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
};

/** Embeds one user's text (a saved job profile), metered to that user through callGateway(). */
export async function embedUserText(
  text: string,
  user: { supabase: ReturnType<typeof createClient>; userId: string; tier: Plan }
): Promise<number[]> {
  const { provider, model } = MODEL_BY_FEATURE[USER_FEATURE];
  const response = await callGateway({
    ...user,
    feature: USER_FEATURE,
    provider,
    model,
    // ~600 tokens at $0.02/M is a tiny fraction of a credit; 1 is the gateway's floor.
    estimatedCredits: 1,
    // Shadow mode (see GatewayCallParams.shadow): the route's hourly rate limit is the real gate.
    shadow: true,
    invoke: () => createEmbeddings([text]),
    extractUsage: (result) => ({ inputTokens: result.usage.prompt_tokens, outputTokens: 0 }),
  });

  await logApiCost({ userId: user.userId, feature: USER_FEATURE, provider, model, inputTokens: response.usage.prompt_tokens, outputTokens: 0 });
  return response.data[0].embedding;
}
