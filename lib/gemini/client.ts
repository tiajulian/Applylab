import { GoogleGenAI } from "@google/genai";

// Same timeout reasoning as lib/anthropic/client.ts / lib/openai/client.ts: a serverless function
// needs a bounded worst case, not the SDK default of "wait indefinitely." Unlike those two SDKs,
// this one has no built-in maxRetries option to pair with it.
export const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: { timeout: 55_000 },
});
