// Model ID only, no client construction - lib/anthropic/models.ts (the app-wide
// provider/model source of truth) imports this instead of lib/openai/client.ts so that a
// missing OPENAI_API_KEY doesn't crash every AI feature in the app, only the ones that actually
// call OpenAI. See lib/openai/client.ts for the client instance.
export const OPENAI_MODEL_MINI = "gpt-4o-mini";

// OpenAI's cheapest GPT-5.6 tier ($0.20/M input, $1.20/M output - roughly 1/40th Sonnet 4.6's
// price). See lib/anthropic/models.ts's MODEL_BY_FEATURE["skills-bridge"] comment for the
// 4-scenario comparison that justified moving skills-bridge here.
export const OPENAI_MODEL_LUNA = "gpt-5.6-luna";

// Job Matcher embeddings ($0.02/M input tokens). The dimension count is baked into the
// vector(1536) columns in supabase/migrations/20260928000000_job_matching.sql.
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
