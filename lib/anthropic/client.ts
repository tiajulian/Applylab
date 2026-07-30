import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Cheaper/faster tier for structured extraction and classification tasks (profile parsing,
// ATS/content scoring) — verified via a side-by-side comparison against Sonnet before
// switching: extraction fidelity and scoring judgment were comparable at ~1/3 the cost. Kept
// off the generative-writing call sites (resume/cover-letter generation, retailoring), where
// output quality is the product itself.
export const CLAUDE_MODEL_FAST = "claude-haiku-4-5-20251001";
