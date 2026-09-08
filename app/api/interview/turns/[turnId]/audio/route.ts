import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { callGateway, synthesizeSpeech, TtsError } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import type { InterviewTurn } from "@/types";

export const dynamic = "force-dynamic";
// Was 30 before this route went through the gateway - callGateway retries a failing invoke() up
// to MAX_GATEWAY_RETRIES+1 (3) times, and synthesizeSpeech's own AbortSignal.timeout is 20s per
// attempt, so a slow/failing Cloud TTS call can now take up to ~60s before the gateway gives up
// and refunds. 30s risked Vercel killing the function with a raw platform timeout before the
// route's own graceful 502 fallback ever ran. See generate-resume/route.ts for the same reasoning
// applied there first.
export const maxDuration = 90;

const TTS_FEATURE = "interview-audio-tts" as const;

// Stopgap only (spec §12 step 1): narrower exposure than most of the other stopgapped routes -
// synthesis only ever runs once per turn (see turn.audio_url short-circuit below), so this only
// bounds how many NEW turns' audio one user can synthesize per hour, not repeat listens.
const RATE_LIMIT_PER_HOUR = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Generates (once) and serves cached WaveNet audio for an interview question. First request for
 * a turn synthesizes and stores the MP3 in Supabase Storage; every request after that - replays,
 * revisits, other devices - just returns the stored URL, so Cloud TTS is only ever called once
 * per question regardless of how many times it's listened to.
 */
export async function GET(
  request: Request,
  { params }: { params: { turnId: string } }
) {
  try {
    const { authUserId, appUser } = await requireUser(request);
    const { turnId } = params;

    const supabase = createClient();

    // RLS ("Users can view own interview turns") scopes this to turns on sessions this user owns.
    const { data: turnRow, error: turnError } = await supabase
      .from("interview_turns")
      .select("*")
      .eq("id", turnId)
      .single();

    if (turnError || !turnRow) {
      return NextResponse.json({ error: "Interview turn not found" }, { status: 404 });
    }

    const turn = turnRow as InterviewTurn;

    if (turn.audio_url) {
      return NextResponse.json({ audioUrl: turn.audio_url });
    }

    const spokenText = turn.question_text.replace(/^\[(.*?)\]\s*/, "");

    const allowed = await checkAndRecordRateLimit(
      createServiceRoleClient(),
      `interview-audio:${authUserId}`,
      RATE_LIMIT_PER_HOUR,
      RATE_LIMIT_WINDOW_MS
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many audio requests for now. Try again shortly." }, { status: 429 });
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = await callGateway({
        supabase,
        userId: authUserId,
        tier: appUser.plan,
        feature: TTS_FEATURE,
        provider: MODEL_BY_FEATURE[TTS_FEATURE].provider,
        model: MODEL_BY_FEATURE[TTS_FEATURE].model,
        // $4/1M characters (see costLog.ts) - a typical interview question runs well under 500
        // characters (~0.002 credits at $0.001/credit), so this is generous headroom, not a tight
        // estimate.
        estimatedCredits: 5,
        // Shadow mode (see GatewayCallParams.shadow): this route's hourly stopgap above is still
        // the only thing that can actually block a request.
        shadow: true,
        invoke: () => synthesizeSpeech(spokenText),
        // No usage metadata comes back from Cloud TTS itself - the thing billed is the input text
        // length, which the closure already has. outputTokens is meaningless for a per-character
        // provider (see costLog.ts's GOOGLE_TTS_PRICING_PER_MILLION_CHARACTERS), left at 0.
        extractUsage: () => ({ inputTokens: spokenText.length, outputTokens: 0 }),
      });

      // Closes the spec §8 gap: TTS spend was previously invisible to api_cost_log entirely, not
      // just the new ledger. Kept alongside the gateway's own ledger write, same "both tables
      // coexist during the transition" reasoning as every other ported feature.
      await logApiCost({
        userId: authUserId,
        feature: TTS_FEATURE,
        provider: MODEL_BY_FEATURE[TTS_FEATURE].provider,
        model: MODEL_BY_FEATURE[TTS_FEATURE].model,
        inputTokens: spokenText.length,
        outputTokens: 0,
      });
    } catch (err) {
      if (err instanceof TtsError) {
        console.error("Cloud TTS synthesis failed", err);
        return NextResponse.json({ error: "Speech synthesis unavailable" }, { status: 502 });
      }
      throw err;
    }

    const serviceClient = createServiceRoleClient();
    const storagePath = `${authUserId}/${turnId}.mp3`;

    const { error: uploadError } = await serviceClient.storage
      .from("interview-audio")
      .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      console.error("Failed to upload interview audio", uploadError);
      return NextResponse.json({ error: "Failed to store audio" }, { status: 500 });
    }

    const { data: publicUrlData } = serviceClient.storage
      .from("interview-audio")
      .getPublicUrl(storagePath);

    const { error: updateError } = await serviceClient
      .from("interview_turns")
      .update({ audio_url: publicUrlData.publicUrl })
      .eq("id", turnId);

    if (updateError) {
      console.error("Failed to persist interview audio URL", updateError);
    }

    return NextResponse.json({ audioUrl: publicUrlData.publicUrl });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("interview turn audio error", error);
    return NextResponse.json({ error: "Failed to get turn audio" }, { status: 500 });
  }
}
