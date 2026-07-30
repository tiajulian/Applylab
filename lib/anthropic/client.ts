import Anthropic from "@anthropic-ai/sdk";

// The SDK default (10 min timeout, 2 retries) is far too patient for a serverless function —
// a hung request would eat the whole function's execution budget before anything times out.
// The SDK already retries with exponential backoff on connection errors, 408/409/429, and 5xx,
// so a short per-attempt timeout plus a couple of retries is enough to ride out transient
// failures without risking the platform killing the invocation before we can respond.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 20_000,
  maxRetries: 2,
});

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Cheaper/faster tier for structured extraction and classification tasks (profile parsing,
// ATS/content scoring) — verified via a side-by-side comparison against Sonnet before
// switching: extraction fidelity and scoring judgment were comparable at ~1/3 the cost. Kept
// off the generative-writing call sites (resume/cover-letter generation, retailoring), where
// output quality is the product itself.
export const CLAUDE_MODEL_FAST = "claude-haiku-4-5-20251001";
