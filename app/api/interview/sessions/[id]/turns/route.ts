import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { scoreInterviewAnswer } from "@/lib/gemini/scoreInterviewAnswer";
import { generateInterviewReport } from "@/lib/gemini/generateInterviewReport";
import { decideFollowup } from "@/lib/interview/followup";
import type { InterviewTurn, InterviewSession, Resume, UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Base64 inflates size ~4/3x; 15MB of raw audio (well over any answer this feature expects -
// see VoiceRecorder's ~2min target) covers legitimate use with headroom while still bounding
// worst-case payload/Gemini-call size against a direct API abuse attempt.
const MAX_AUDIO_BASE64_LENGTH = 20 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"];

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { turnId, audioBase64, mimeType, durationSec, textAnswer } = body;

    if (!turnId || typeof turnId !== "string") {
      return NextResponse.json({ error: "turnId is required" }, { status: 400 });
    }

    if (!audioBase64 && (!textAnswer || !textAnswer.trim())) {
      return NextResponse.json(
        { error: "Either audio recording or text answer is required" },
        { status: 400 }
      );
    }

    if (audioBase64) {
      if (typeof audioBase64 !== "string" || audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
        return NextResponse.json({ error: "Audio recording is too large" }, { status: 400 });
      }
      const normalizedMime = typeof mimeType === "string" ? mimeType.split(";")[0].trim() : "";
      if (!ALLOWED_AUDIO_MIME_TYPES.includes(normalizedMime)) {
        return NextResponse.json({ error: "Unsupported audio format" }, { status: 400 });
      }
    }

    const supabase = createClient();

    // 1. Verify session ownership and in_progress status
    const { data: sessionRow, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("*, resumes(*)")
      .eq("id", sessionId)
      .eq("user_id", authUserId)
      .single();

    if (sessionError || !sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const session = sessionRow as InterviewSession & { resumes: Resume };
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "This interview session is already finished" }, { status: 400 });
    }

    // 2. Fetch the target turn
    const { data: currentTurnRow, error: turnError } = await supabase
      .from("interview_turns")
      .select("*")
      .eq("id", turnId)
      .eq("session_id", sessionId)
      .single();

    if (turnError || !currentTurnRow) {
      return NextResponse.json({ error: "Interview turn not found" }, { status: 404 });
    }

    const currentTurn = currentTurnRow as InterviewTurn;

    // Reject a replay of an already-scored turn: without this, resubmitting the same turnId
    // re-calls Gemini, overwrites the stored scores, and (via decideFollowup below) can insert
    // an unbounded number of follow-up turns by repeatedly presenting the same main question as
    // not-yet-a-followup - bypassing the one-followup-per-question cap in lib/interview/followup.ts.
    if (currentTurn.transcript !== null) {
      return NextResponse.json({ error: "This turn has already been answered" }, { status: 409 });
    }

    // 3. Fetch candidate profile for evidence grounding
    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    const profile = (profileRow || {}) as Partial<UserProfile>;
    const experienceEvidence = profile.work_experience
      ?.map((w) => `${w.job_title} at ${w.company}: ${w.description} ${w.wins?.map((win) => win.text).join(", ") || ""}`)
      .join("\n") || "";

    const projectsEvidence = profile.projects
      ?.map((p) => `Project ${p.title}: ${p.description} (Tools: ${p.tools?.join(", ") || ""})`)
      .join("\n") || "";

    const candidateEvidence = [experienceEvidence, projectsEvidence].filter(Boolean).join("\n\n");

    // 4. Score the answer with Gemini
    const scoreResult = await scoreInterviewAnswer({
      userId: authUserId,
      mode: session.mode,
      questionText: currentTurn.question_text,
      questionType: currentTurn.question_type,
      stageType: session.stage_type,
      audioBase64,
      mimeType,
      durationSec: durationSec ? Number(durationSec) : undefined,
      textAnswer,
      jobContext: {
        jobTitle: session.resumes?.job_title || "Target Role",
        companyName: session.resumes?.company_name || "Target Company",
      },
      candidateEvidence,
    });

    const serviceClient = createServiceRoleClient();

    // 5. Update the current turn with AI scores & metrics via service role
    const updatePayload: Record<string, any> = {
      transcript: scoreResult.transcript,
      answer_source: audioBase64 ? "voice" : "text",
      duration_sec: scoreResult.duration_sec > 0 ? scoreResult.duration_sec : null,
      wpm: scoreResult.wpm > 0 ? scoreResult.wpm : null,
      filler_count: scoreResult.filler_count,
      star_scores: scoreResult.star_scores,
      content_feedback: scoreResult.content_feedback,
      delivery_feedback: scoreResult.delivery_feedback,
      suggested_answer: scoreResult.suggested_answer,
    };

    if (scoreResult.technical_assessment) {
      updatePayload.technical_assessment = scoreResult.technical_assessment;
    }

    const { data: updatedTurnRow, error: updateTurnError } = await serviceClient
      .from("interview_turns")
      .update(updatePayload)
      .eq("id", currentTurn.id)
      .select("*")
      .single();

    if (updateTurnError || !updatedTurnRow) {
      console.error("Failed to update interview turn", updateTurnError);
      return NextResponse.json({ error: "Failed to persist turn scores" }, { status: 500 });
    }

    const updatedTurn = updatedTurnRow as InterviewTurn;

    // 6. Fetch all turns to check completion and count
    const { data: allTurns } = await serviceClient
      .from("interview_turns")
      .select("*")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    const turnsList = (allTurns || []) as InterviewTurn[];
    const completedCount = turnsList.filter((t) => t.transcript !== null).length;

    // 7. Decide follow-up
    const followupDecision = decideFollowup({
      isCurrentTurnFollowup: currentTurn.is_followup,
      needsFollowup: scoreResult.needs_followup,
      followupQuestion: scoreResult.followup_question,
      totalCompletedTurns: completedCount,
    });

    if (followupDecision.shouldFollowup && followupDecision.followupQuestionText) {
      // Shift future turns by +1
      const futureTurns = turnsList.filter((t) => t.order_index > currentTurn.order_index);
      for (const ft of futureTurns) {
        await serviceClient
          .from("interview_turns")
          .update({ order_index: ft.order_index + 1 })
          .eq("id", ft.id);
      }

      // Insert adaptive follow-up turn
      const { data: followupTurn, error: followupInsertError } = await serviceClient
        .from("interview_turns")
        .insert({
          session_id: sessionId,
          order_index: currentTurn.order_index + 1,
          question_type: "followup",
          question_text: followupDecision.followupQuestionText,
          is_followup: true,
          parent_turn_id: currentTurn.id,
        })
        .select("*")
        .single();

      if (!followupInsertError && followupTurn) {
        return NextResponse.json({
          turn: updatedTurn,
          next_question: {
            id: followupTurn.id,
            order_index: followupTurn.order_index,
            question_type: followupTurn.question_type,
            question_text: followupTurn.question_text,
            is_followup: true,
          },
          done: false,
        });
      }
    }

    // 8. Find next pending question
    const remainingTurns = turnsList.filter(
      (t) => t.id !== currentTurn.id && t.transcript === null && t.order_index > currentTurn.order_index
    );

    if (remainingTurns.length > 0) {
      const nextTurn = remainingTurns[0];
      return NextResponse.json({
        turn: updatedTurn,
        next_question: {
          id: nextTurn.id,
          order_index: nextTurn.order_index,
          question_type: nextTurn.question_type,
          question_text: nextTurn.question_text,
          is_followup: nextTurn.is_followup,
        },
        done: false,
      });
    }

    // 9. All turns complete -> generate final report
    const finalTurns = turnsList.map((t) => (t.id === updatedTurn.id ? updatedTurn : t));
    const report = await generateInterviewReport({
      userId: authUserId,
      mode: session.mode,
      stageType: session.stage_type,
      jobTitle: session.resumes?.job_title || "Target Role",
      companyName: session.resumes?.company_name || "Target Company",
      turns: finalTurns,
    });

    // Update session status & report via service role
    await serviceClient
      .from("interview_sessions")
      .update({
        status: "completed",
        overall_score: report.overall_score,
        report,
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return NextResponse.json({
      turn: updatedTurn,
      report,
      done: true,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to submit interview turns" }, { status: 403 });
    }
    console.error("submit interview turn error", error);
    return NextResponse.json({ error: "Failed to score interview answer" }, { status: 500 });
  }
}
