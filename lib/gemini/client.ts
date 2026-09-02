import { GoogleGenAI } from "@google/genai";

// Same timeout reasoning as lib/anthropic/client.ts / lib/openai/client.ts: a serverless function
// needs a bounded worst case, not the SDK default of "wait indefinitely." Unlike those two SDKs,
// this one has no built-in maxRetries option to pair with it.
export const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: { timeout: 55_000 },
});

/**
 * Total billed output tokens for one Gemini response, for logApiCost's outputTokens field.
 * Google bills "thinking" tokens as part of output at the standard output rate (confirmed
 * against Gemini's own pricing page: "Output price (including thinking tokens)") - candidatesTokenCount
 * alone undercounts real cost, even at thinkingBudget: 1 (thinking still runs; the budget isn't a
 * hard cap). Single source of truth so every Gemini call site logs cost the same way instead of
 * five copies of this arithmetic drifting apart.
 */
export function geminiOutputTokens(usageMetadata: {
  candidatesTokenCount?: number | null;
  thoughtsTokenCount?: number | null;
} | undefined): number {
  return (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0);
}
