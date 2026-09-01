import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { synthesizeSpeech, TtsError } from "@/lib/googleTts/synthesizeSpeech";
import type { InterviewTurn } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    const { authUserId } = await requireUser(request);
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

    let audioBuffer: Buffer;
    try {
      audioBuffer = await synthesizeSpeech(spokenText);
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
