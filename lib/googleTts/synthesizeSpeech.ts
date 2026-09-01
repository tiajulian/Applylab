const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

// A WaveNet voice with warm, conversational prosody - picked to match the "Natural"/"Google"
// preference already encoded in QuestionCard's browser-voice fallback (pickBestVoice).
const VOICE_NAME = "en-US-Wavenet-F";
const LANGUAGE_CODE = "en-US";

export class TtsError extends Error {}

/**
 * Synthesizes speech via Google Cloud Text-to-Speech (WaveNet). Returns raw MP3 bytes.
 * Callers should catch TtsError and fall back to the browser's speechSynthesis rather than
 * surfacing a hard failure - see the reasoning in app/api/interview/turns/[turnId]/audio/route.ts.
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!apiKey) {
    throw new TtsError("GOOGLE_CLOUD_TTS_API_KEY is not configured");
  }

  const response = await fetch(`${TTS_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: LANGUAGE_CODE, name: VOICE_NAME },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TtsError(`Cloud TTS request failed (${response.status}): ${body}`);
  }

  const { audioContent } = (await response.json()) as { audioContent?: string };
  if (!audioContent) {
    throw new TtsError("Cloud TTS response had no audioContent");
  }

  return Buffer.from(audioContent, "base64");
}
