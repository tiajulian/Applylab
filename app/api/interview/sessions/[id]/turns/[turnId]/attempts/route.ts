import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { ANSWERS_PER_HOUR, answerPayloadError, scoringClaimStaleBefore } from "@/lib/interview/answerPayload";
import { MAX_RETRIES_PER_TURN } from "@/lib/interview/scoreLabels";
import { DEFAULT_PRESSURE_LEVEL, isPressureLevel } from "@/lib/interview/setupConstants";
import {
  loadAnswerEvidence,
  PRACTICE_RESUME_DELETED_MESSAGE,
  PracticeResumeDeletedError,
  scoreAnswerHonestly,
  scoredFields,
} from "@/lib/interview/sessionFlow";
import { sessionJob } from "@/lib/interview/uploadedResume";
import { rubricOf, turnScores } from "@/lib/interview/rubrics";
import type { InterviewSession, InterviewTurn, InterviewTurnAttempt, Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180; // = SCORING_ROUTE_MAX_SEC (lib/interview/answerPayload.ts)

function attemptResponse(attempt: InterviewTurnAttempt) {
  return NextResponse.json({
    attempt,
    triesLeft: Math.max(0, 1 + MAX_RETRIES_PER_TURN - attempt.attempt_number),
  });
}

/**
 * "Try again" on an answered question. Scored exactly like a first answer, stored as attempt 2
 * or 3; never adds a follow-up and never changes the question count. The turn keeps attempt 1,
 * so the honest first-try record is untouched.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string; turnId: string } }
) {
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const rateLimited = await enforceRateLimit(`interview-turn:${authUserId}`, ANSWERS_PER_HOUR, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const heavy = await acquireHeavySlots(createServiceRoleClient(), "interview-turn", authUserId);
    if ("response" in heavy) return heavy.response;
    releaseSlot = heavy.release;

    const body = await request.json();
    const invalid = answerPayloadError(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const { audioBase64, mimeType, durationSec, textAnswer, submissionId } = body;

    const supabase = createClient();
    const { data: sessionRow } = await supabase
      .from("interview_sessions")
      .select("*, resumes(*)")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .single();
    if (!sessionRow) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const session = sessionRow as InterviewSession & { resumes: Resume | null };

    const { data: turnRow } = await supabase
      .from("interview_turns")
      .select("*")
      .eq("id", params.turnId)
      .eq("session_id", session.id)
      .single();
    if (!turnRow) return NextResponse.json({ error: "Interview turn not found" }, { status: 404 });
    const turn = turnRow as InterviewTurn;

    if (submissionId) {
      const { data: existing } = await supabase
        .from("interview_turn_attempts")
        .select("*")
        .eq("turn_id", turn.id)
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (existing) return attemptResponse(existing as InterviewTurnAttempt);
    }

    if (turn.transcript === null || !turnScores(turn)) {
      return NextResponse.json({ error: "Only answered, scored questions can be tried again" }, { status: 400 });
    }
    // Once the report is built it is the record of this session; more tries go in a new one.
    if (session.report_status === "building" || session.report_status === "ready") {
      return NextResponse.json({ error: "Your report is already built. Start a new practice to try again." }, { status: 409 });
    }
    const attemptCount = turn.attempt_count ?? 1;
    if (attemptCount >= 1 + MAX_RETRIES_PER_TURN) {
      return NextResponse.json({ error: "You've used all your tries for this question." }, { status: 409 });
    }

    const serviceClient = createServiceRoleClient();

    // Same claim as a first answer (the turn is answered, so the column is free to reuse): one
    // retry is scored at a time, and the attempt_count match means a stale view can't double up.
    const staleBefore = scoringClaimStaleBefore();
    const { data: claimed } = await serviceClient
      .from("interview_turns")
      .update({ scoring_started_at: new Date().toISOString() })
      .eq("id", turn.id)
      .eq("attempt_count", attemptCount)
      .or(`scoring_started_at.is.null,scoring_started_at.lt.${staleBefore}`)
      .select("id")
      .maybeSingle();
    if (!claimed) {
      return NextResponse.json(
        { error: "We're still scoring your last try. Try again in a moment.", code: "STILL_PROCESSING" },
        { status: 409 }
      );
    }
    const releaseClaim = () =>
      serviceClient.from("interview_turns").update({ scoring_started_at: null }).eq("id", turn.id);

    try {
      const { profile, resumeEvidence } = await loadAnswerEvidence(supabase, authUserId, session);
      const job = sessionJob(session);
      const result = await scoreAnswerHonestly(
        {
          userId: authUserId,
          supabase,
          tier: appUser.plan,
          mode: session.mode,
          questionText: turn.question_text,
          questionType: turn.question_type,
          stageType: session.stage_type,
          audioBase64,
          mimeType,
          durationSec: durationSec ? Number(durationSec) : undefined,
          textAnswer,
          jobContext: {
            jobTitle: job.jobTitle || "Target Role",
            companyName: job.companyName || "Target Company",
          },
          pressureLevel: isPressureLevel(session.pressure_level) ? session.pressure_level : DEFAULT_PRESSURE_LEVEL,
          rubric: rubricOf(turn),
        },
        profile,
        resumeEvidence
      );

      const attemptNumber = attemptCount + 1;
      const { data: attempt, error: insertError } = await serviceClient
        .from("interview_turn_attempts")
        .insert({
          ...scoredFields(result, audioBase64 ? "voice" : "text", submissionId ?? null),
          turn_id: turn.id,
          session_id: session.id,
          user_id: authUserId,
          attempt_number: attemptNumber,
        })
        .select("*")
        .single();

      if (insertError || !attempt) {
        console.error("Failed to store interview attempt", insertError);
        await releaseClaim();
        return NextResponse.json({ error: "Failed to save your try" }, { status: 500 });
      }

      await serviceClient
        .from("interview_turns")
        .update({ attempt_count: attemptNumber, scoring_started_at: null })
        .eq("id", turn.id);

      return attemptResponse(attempt as InterviewTurnAttempt);
    } catch (err) {
      await releaseClaim();
      throw err;
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to practise interviews" }, { status: 403 });
    }
    if (error instanceof PracticeResumeDeletedError) {
      return NextResponse.json({ error: PRACTICE_RESUME_DELETED_MESSAGE }, { status: 409 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("interview attempt error", error);
    return NextResponse.json({ error: "Failed to score your try" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
