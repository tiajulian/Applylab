import { openai } from "@/lib/openai/client";
import { EMBEDDING_DIMENSIONS, OPENAI_EMBEDDING_MODEL } from "@/lib/openai/models";
import { estimateCostUsd } from "@/lib/anthropic/costLog";
import { assertAiAvailable, recordAiCommit, recordAiReserve } from "@/lib/aiGateway/breakerGuard";

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

/**
 * Embeds text for system work that has no user behind it (the daily job ingestion), so there is
 * no per-user credit ledger to reserve against. It still sits behind the AI circuit breaker and
 * feeds the breaker's spend velocity; per-user embeddings (a saved job profile) go through
 * callGateway() instead so they are metered to that user.
 */
export const embedSystemTexts: EmbedFn = async (texts) => {
  if (texts.length === 0) return [];
  await assertAiAvailable();
  await recordAiReserve(0);

  const response = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const costUsd = estimateCostUsd("openai", OPENAI_EMBEDDING_MODEL, response.usage.prompt_tokens, 0, 0, 0);
  await recordAiCommit(0, costUsd);

  return [...response.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
};
