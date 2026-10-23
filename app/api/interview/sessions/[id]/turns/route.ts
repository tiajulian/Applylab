import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { assertSessionAccess } from "@/lib/interview/allowance";
import { decideFollowup } from "@/lib/interview/followup";
import { rubricOf } from "@/lib/interview/rubrics";
import {
  completeSession,
  loadAnswerEvidence,
  nextPendingTurn,
  PRACTICE_RESUME_DELETED_MESSAGE,
  PracticeResumeDeletedError,
  nextQuestionPayload,
  scoreAnswerHonestly,
  scoredFields,
} from "@/lib/interview/sessionFlow";
import { ANSWERS_PER_HOUR, answerPayloadError, scoringClaimStaleBefore } from "@/lib/interview/answerPayload";
import { sessionJob } from "@/lib/interview/uploadedResume";
import type { InterviewTurn, InterviewSession, Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // = SCORING_ROUTE_MAX_SEC (lib/interview/answerPayload.ts)

/**
 * Rebuilds the response for an answer that was already stored under the same submissionId - the
 * client retried after losing the first response. Returns what the first request returned
 * instead of a 409, without scoring again.
 */
async function replayResponse(supabase: ReturnType<typeof createClient>, sessionId: string, scoredTurn: InterviewTurn) {
  const { data: turns } = await supabase.from("interview_turns").select("*").eq("session_id", sessionId);
  const next = nextPendingTurn((turns || []) as InterviewTurn[], scoredTurn);
  return NextResponse.json(
    next
      ? { turn: scoredTurn, next_question: nextQuestionPayload(next), done: false }
      : { turn: scoredTurn, done: true }
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser();

    const rateLimited = await enforceRateLimit(`interview-turn:${authUserId}`, ANSWERS_PER_HOUR, 60 * 60_000);
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
    const invalid = answerPayloadError(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

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

    const session = sessionRow as InterviewSession & { resumes: Resume | null };
    assertSessionAccess(appUser, session);

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
    // Retrying an answered question goes through the attempts route instead.
    if (currentTurn.transcript !== null) {
      if (submissionId && currentTurn.submission_id === submissionId) {
        return replayResponse(supabase, sessionId, currentTurn);
      }
      return NextResponse.json({ error: "This turn has already been answered" }, { status: 409 });
    }
    if (currentTurn.skipped) {
      return NextResponse.json({ error: "This question was skipped" }, { status: 409 });
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
    const staleBefore = scoringClaimStaleBefore();
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

    // 3. Score the answer (with the honesty check). On failure the claim is released so
    // "Try again" can score straight away rather than waiting for it to go stale.
    let scoreResult: Awaited<ReturnType<typeof scoreAnswerHonestly>>;
    try {
      const { profile, resumeEvidence } = await loadAnswerEvidence(supabase, authUserId, session);
      const job = sessionJob(session);
      scoreResult = await scoreAnswerHonestly(
        {
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
            jobTitle: job.jobTitle || "Target Role",
            companyName: job.companyName || "Target Company",
          },
          rubric: rubricOf(currentTurn),
        },
        profile,
        resumeEvidence
      );
    } catch (err) {
      await releaseClaim();
      throw err;
    }

    // 4. Store the scores. Still only writes while the turn is unanswered: a request whose claim
    // went stale (it ran past maxDuration and another took over) must not overwrite the newer result.
    const updatePayload: Record<string, unknown> = {
      ...scoredFields(scoreResult, audioBase64 ? "voice" : "text", submissionId ?? null),
      // Scored: release the claim so "Try again" (which reuses it) can start straight away.
      scoring_started_at: null,
      // Stored once scored, so the answer is always read on the rubric it was marked with.
      rubric: rubricOf(currentTurn),
    };
    if (scoreResult.technical_assessment) {
      updatePayload.technical_assessment = scoreResult.technical_assessment;
    }

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

    // 5. Fetch all turns to check completion and count
    const { data: allTurns } = await serviceClient
      .from("interview_turns")
      .select("*")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    const turnsList = (allTurns || []) as InterviewTurn[];
    const mainTurnCount = turnsList.filter((t) => !t.is_followup).length;

    // 6. Decide follow-up
    const followupDecision = decideFollowup({
      isCurrentTurnFollowup: currentTurn.is_followup,
      needsFollowup: scoreResult.needs_followup,
      followupQuestion: scoreResult.followup_question,
      followupsSoFar: turnsList.length - mainTurnCount,
      questionCount: session.question_count_target ?? mainTurnCount,
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
          // A follow-up is marked the same way as the question it follows up.
          rubric: rubricOf(currentTurn),
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

    // 7. Next pending question, or finish. The report is built separately when asked for, so
    // the last answer comes back as fast as any other.
    const nextTurn = nextPendingTurn(turnsList, currentTurn);
    if (nextTurn) {
      return NextResponse.json({
        turn: updatedTurn,
        next_question: nextQuestionPayload(nextTurn),
        done: false,
      });
    }

    await completeSession(serviceClient, sessionId, "completed");
    return NextResponse.json({ turn: updatedTurn, done: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to submit interview turns" }, { status: 403 });
    }
    if (error instanceof PracticeResumeDeletedError) {
      return NextResponse.json({ error: PRACTICE_RESUME_DELETED_MESSAGE }, { status: 409 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("submit interview turn error", error);
    return NextResponse.json({ error: "Failed to score interview answer" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
