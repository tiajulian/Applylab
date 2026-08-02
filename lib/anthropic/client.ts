import Anthropic from "@anthropic-ai/sdk";

// The SDK default (10 min timeout, 2 retries) is far too patient for a serverless function —
// a hung request would eat the whole function's execution budget before anything times out.
// The SDK already retries with exponential backoff on connection errors, 408/409/429, and 5xx.
//
// 20s here was measured to be too aggressive: a real resume generation (Sonnet, ~900 output
// tokens) routinely takes 35-40s at standard service tier, meaning most calls were being
// aborted and silently retried from scratch on their first attempt — wasting the first ~20s
// every time, and risking the retried call plus the wasted attempt together exceeding a route's
// Vercel maxDuration. 55s gives real single-attempt calls room to finish without being cut off.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 2,
});

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Cheaper/faster tier, verified via side-by-side comparison against Sonnet before switching each
// feature over. Which feature uses which of these two constants is decided in one place —
// lib/anthropic/models.ts#MODEL_BY_FEATURE — not by importing a constant directly at each call
// site, so a feature's model can be swapped without touching its generator.
export const CLAUDE_MODEL_FAST = "claude-haiku-4-5-20251001";
