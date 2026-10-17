import { isUuid } from "@/lib/jobs/api";

// Base64 inflates size ~4/3x; 15MB of raw audio (well over any answer this feature expects -
// see VoiceRecorder's 2 minute guide) covers legitimate use with headroom while still bounding
// worst-case payload/Gemini-call size against a direct API abuse attempt.
const MAX_AUDIO_BASE64_LENGTH = 20 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"];

/**
 * How long scoring one answer may take: a scoring call, one retry on unusable output, and the
 * honesty rewrite, back to back. Must equal `maxDuration` in the turns and attempts routes (a
 * route segment config has to be a literal there; their tests assert the two match).
 */
export const SCORING_ROUTE_MAX_SEC = 180;

/** A scoring claim older than this belongs to a request the platform already killed. */
export const SCORING_CLAIM_MS = (SCORING_ROUTE_MAX_SEC + 10) * 1000;

export const scoringClaimStaleBefore = () => new Date(Date.now() - SCORING_CLAIM_MS).toISOString();

/** Answers per hour per user, first answers and "Try again" answers together. */
export const ANSWERS_PER_HOUR = 80;

/** Validates an answer body (turns and attempts routes). Returns an error message or null. */
export function answerPayloadError(body: Record<string, unknown>): string | null {
  const { audioBase64, mimeType, textAnswer, submissionId } = body;
  if (submissionId !== undefined && (typeof submissionId !== "string" || !isUuid(submissionId))) {
    return "Invalid submissionId";
  }
  if (!audioBase64 && (typeof textAnswer !== "string" || !textAnswer.trim())) {
    return "Either audio recording or text answer is required";
  }
  if (audioBase64) {
    if (typeof audioBase64 !== "string" || audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
      return "Audio recording is too large";
    }
    const normalizedMime = typeof mimeType === "string" ? mimeType.split(";")[0].trim() : "";
    if (!ALLOWED_AUDIO_MIME_TYPES.includes(normalizedMime)) return "Unsupported audio format";
  }
  return null;
}
