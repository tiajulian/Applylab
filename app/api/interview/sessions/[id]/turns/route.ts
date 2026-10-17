import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { scoreInterviewAnswer } from "@/lib/gemini/scoreInterviewAnswer";
import { generateInterviewReport } from "@/lib/gemini/generateInterviewReport";
import { decideFollowup } from "@/lib/interview/followup";
import { DEFAULT_PRESSURE_LEVEL, isPressureLevel } from "@/lib/interview/setupConstants";
import { isUuid } from "@/lib/jobs/api";
import type { InterviewTurn, InterviewSession, Resume, UserProfile } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Base64 inflates size ~4/3x; 15MB of raw audio (well over any answer this feature expects -
// see VoiceRecorder's ~2min target) covers legitimate use with headroom while still bounding
// worst-case payload/Gemini-call size against a direct API abuse attempt.
const MAX_AUDIO_BASE64_LENGTH = 20 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg"];
// Just past maxDuration: a claim this old belongs to a request the platform already killed.
const SCORING_CLAIM_MS = (maxDuration + 10) * 1000;

function nextQuestionPayload(turn: InterviewTurn) {
  return {
    id: turn.id,
    order_index: turn.order_index,
    question_type: turn.question_type,
    question_text: turn.question_text,
    is_followup: turn.is_followup,
  };
}

/** The first unanswered turn after `after` in session order (a follow-up sits right after its
 *  parent, so it comes first when one was added). */
function nextPendingTurn(turns: InterviewTurn[], after: InterviewTurn): InterviewTurn | null {
  return (
    turns
      .filter((t) => t.id !== after.id && t.transcript === null && t.order_index > after.order_index)
      .sort((a, b) => a.order_index - b.order_index)[0] ?? null
  );
}

/**
 * Rebuilds the response for an answer that was already stored under the same submissionId - the
 * client retried after losing the first response. Returns what the first request returned
 * instead of a 409, without scoring again.
 */
async function replayResponse(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  scoredTurn: InterviewTurn
) {
  const [{ data: session }, { data: turns }] = await Promise.all([
    supabase.from("interview_sessions").select("status, report").eq("id", sessionId).single(),
    supabase.from("interview_turns").select("*").eq("session_id", sessionId),
  ]);

  const next = nextPendingTurn((turns || []) as InterviewTurn[], scoredTurn);
  if (next) {
    return NextResponse.json({ turn: scoredTurn, next_question: nextQuestionPayload(next), done: false });
  }
  if (session?.status === "completed" && session.report) {
    return NextResponse.json({ turn: scoredTurn, report: session.report, done: true });
  }
  // The first request is still building the report.
  return NextResponse.json(
    { error: "We're still finishing this answer. Try again in a moment.", code: "STILL_PROCESSING" },
    { status: 409 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const rateLimited = await enforceRateLimit(`interview-turn:${authUserId}`, 40, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const heavy = await acquireHeavySlots(createServiceRoleClient(), "interview-turn", authUserId);
    if ("response" in heavy) return heavy.response;
    releaseSlot = heavy.release;

    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { turnId, audioBase64, mimeType, durationSec, textAnswer, submissionId } = body;

    if (!turnId || typeof turnId !== "string") {
      return NextResponse.json({ error: "turnId is required" }, { status: 400 });
    }

    if (submissionId !== undefined && (typeof submissionId !== "string" || !isUuid(submissionId))) {
      return NextResponse.json({ error: "Invalid submissionId" }, { status: 400 });
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

    // 1. Verify session ownership
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
    // The one exception is the same submission retried: that returns the stored result.
    if (currentTurn.transcript !== null) {
      if (submissionId && currentTurn.submission_id === submissionId) {
        return replayResponse(supabase, sessionId, currentTurn);
      }
      return NextResponse.json({ error: "This turn has already been answered" }, { status: 409 });
    }

    // Checked after the replay branch: a retry of the final answer arrives once the session has
    // already completed, and must still get its stored result back.
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "This interview session is already finished" }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();

    // Claim the turn for scoring. A second submit while the first is still being scored (a retry
    // after a dropped connection) waits instead of paying for another Gemini call. A claim older
    // than this route's maxDuration belongs to a request that died, so it can be taken over.
    const staleBefore = new Date(Date.now() - SCORING_CLAIM_MS).toISOString();
    const { data: claimed } = await serviceClient
      .from("interview_turns")
      .update({ scoring_started_at: new Date().toISOString(), submission_id: submissionId ?? null })
      .eq("id", currentTurn.id)
      .is("transcript", null)
      .or(`scoring_started_at.is.null,scoring_started_at.lt.${staleBefore}`)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return NextResponse.json(
        { error: "We're still scoring your last answer. Try again in a moment.", code: "STILL_PROCESSING" },
        { status: 409 }
      );
    }

    const releaseClaim = () =>
      serviceClient
        .from("interview_turns")
        .update({ scoring_started_at: null })
        .eq("id", currentTurn.id)
        .is("transcript", null);

    const pressureLevel = isPressureLevel(session.pressure_level) ? session.pressure_level : DEFAULT_PRESSURE_LEVEL;

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

    // 4. Score the answer with Gemini. On failure the claim is released so "Try again" can
    // score straight away rather than waiting for it to go stale.
    let scoreResult: Awaited<ReturnType<typeof scoreInterviewAnswer>>;
    try {
      scoreResult = await scoreInterviewAnswer({
        userId: authUserId,
        supabase,
        tier: appUser.plan,
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
        pressureLevel,
      });
    } catch (err) {
      await releaseClaim();
      throw err;
    }

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
      submission_id: submissionId ?? null,
    };

    if (scoreResult.technical_assessment) {
      updatePayload.technical_assessment = scoreResult.technical_assessment;
    }

    // Still only writes while the turn is unanswered: a request whose claim went stale (it ran
    // past maxDuration and another took over) must not overwrite the newer result.
    const { data: updatedTurnRow, error: updateTurnError } = await serviceClient
      .from("interview_turns")
      .update(updatePayload)
      .eq("id", currentTurn.id)
      .is("transcript", null)
      .select("*")
      .maybeSingle();

    if (updateTurnError) {
      console.error("Failed to update interview turn", updateTurnError);
      await releaseClaim();
      return NextResponse.json({ error: "Failed to persist turn scores" }, { status: 500 });
    }

    if (!updatedTurnRow) {
      const { data: winner } = await serviceClient
        .from("interview_turns")
        .select("*")
        .eq("id", currentTurn.id)
        .single();
      if (winner && submissionId && winner.submission_id === submissionId) {
        return replayResponse(supabase, sessionId, winner as InterviewTurn);
      }
      return NextResponse.json({ error: "This turn has already been answered" }, { status: 409 });
    }

    const updatedTurn = updatedTurnRow as InterviewTurn;

    // 6. Fetch all turns to check completion and count
    const { data: allTurns } = await serviceClient
      .from("interview_turns")
      .select("*")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    const turnsList = (allTurns || []) as InterviewTurn[];
    const mainTurnCount = turnsList.filter((t) => !t.is_followup).length;

    // 7. Decide follow-up
    const followupDecision = decideFollowup({
      isCurrentTurnFollowup: currentTurn.is_followup,
      needsFollowup: scoreResult.needs_followup,
      followupQuestion: scoreResult.followup_question,
      followupsSoFar: turnsList.length - mainTurnCount,
      questionCount: session.question_count_target ?? mainTurnCount,
      pressureLevel,
      starScores: scoreResult.star_scores,
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
          next_question: { ...nextQuestionPayload(followupTurn as InterviewTurn), is_followup: true },
          done: false,
        });
      }
    }

    // 8. Find next pending question
    const nextTurn = nextPendingTurn(turnsList, currentTurn);
    if (nextTurn) {
      return NextResponse.json({
        turn: updatedTurn,
        next_question: nextQuestionPayload(nextTurn),
        done: false,
      });
    }

    // 9. All turns complete -> generate final report
    const finalTurns = turnsList.map((t) => (t.id === updatedTurn.id ? updatedTurn : t));
    const report = await generateInterviewReport({
      userId: authUserId,
      supabase,
      tier: appUser.plan,
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
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("submit interview turn error", error);
    return NextResponse.json({ error: "Failed to score interview answer" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
