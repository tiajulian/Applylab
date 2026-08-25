// Model ID only, no client construction - lib/anthropic/models.ts (the app-wide
// provider/model source of truth) imports this instead of lib/openai/client.ts so that a
// missing OPENAI_API_KEY doesn't crash every AI feature in the app, only the ones that actually
// call OpenAI. See lib/openai/client.ts for the client instance.
export const OPENAI_MODEL_MINI = "gpt-4o-mini";
