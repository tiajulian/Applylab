// Model IDs only, no client construction - lib/anthropic/models.ts (the app-wide
// provider/model source of truth) imports this instead of lib/gemini/client.ts so that a
// missing GEMINI_API_KEY doesn't crash every AI feature in the app, only the ones that actually
// call Gemini. See lib/gemini/client.ts for the client instance.
//
// gemini-2.5-flash / gemini-2.5-flash-lite (what the migration report specified) return a 404
// on this account - "no longer available to new users" - confirmed live against the Gemini API
// during implementation. Using the models Google's own error response named as the replacement.
export const GEMINI_MODEL_FLASH = "gemini-3.6-flash";
export const GEMINI_MODEL_FLASH_LITE = "gemini-3.5-flash-lite";
