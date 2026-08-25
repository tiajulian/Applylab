import OpenAI from "openai";

// Same timeout/retry reasoning as lib/anthropic/client.ts: a serverless function needs a
// client-side timeout well under its own execution budget, and the SDK already retries
// connection errors/408/409/429/5xx with backoff.
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 55_000,
  maxRetries: 2,
});
