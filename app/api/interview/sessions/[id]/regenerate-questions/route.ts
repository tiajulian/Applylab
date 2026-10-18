import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { assertSessionAccess } from "@/lib/interview/allowance";
import { generateInterviewQuestions } from "@/lib/gemini/generateInterviewQuestions";
import { loadQuestionContext, loadUploadedQuestionContext, plannedTurnRows } from "@/lib/interview/questionContext";
import { loadUploadedProfile, PRACTICE_RESUME_DELETED_MESSAGE, PracticeResumeDeletedError } from "@/lib/interview/sessionFlow";
import { sessionJob } from "@/lib/interview/uploadedResume";
import { DEFAULT_PRESSURE_LEVEL, STAGE_QUESTION_COUNT, isPressureLevel } from "@/lib/interview/setupConstants";
import type { InterviewSession, InterviewTurn, Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * "Try tailoring again" after a session started on generic fallback questions. Only allowed while
 * nothing has been answered, so no score or feedback is ever thrown away.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser();

    // Same budget as starting a session: this is another full question generation.
    const rateLimited = await enforceRateLimit(`interview-session:${authUserId}`, 10, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const heavy = await acquireHeavySlots(createServiceRoleClient(), "interview-session", authUserId);
    if ("response" in heavy) return heavy.response;
    releaseSlot = heavy.release;

    const supabase = createClient();
    const { data: sessionRow } = await supabase
      .from("interview_sessions")
      .select("*, resumes(*)")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .single();

    if (!sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const session = sessionRow as InterviewSession & { resumes: Resume | null };
    assertSessionAccess(appUser, session);
    if (session.status !== "in_progress" || (session.resume_id && !session.resumes)) {
      return NextResponse.json({ error: "This interview session can't be changed" }, { status: 400 });
    }

    const { data: turnRows } = await supabase
      .from("interview_turns")
      .select("id, transcript")
      .eq("session_id", session.id);
    const oldTurns = (turnRows || []) as Pick<InterviewTurn, "id" | "transcript">[];
    if (oldTurns.some((t) => t.transcript !== null)) {
      return NextResponse.json(
        { error: "You've already answered a question, so these questions can't be replaced." },
        { status: 409 }
      );
    }

    const context = session.resumes
      ? await loadQuestionContext(supabase, authUserId, appUser.plan, session.resumes)
      : await loadUploadedQuestionContext(
          supabase,
          authUserId,
          appUser.plan,
          await loadUploadedProfile(supabase, session),
          sessionJob(session)
        );
    const { questions, usedFallback } = await generateInterviewQuestions({
      userId: authUserId,
      supabase,
      tier: appUser.plan,
      stageType: session.stage_type,
      questionCount: session.question_count_target ?? STAGE_QUESTION_COUNT[session.stage_type],
      pressureLevel: isPressureLevel(session.pressure_level) ? session.pressure_level : DEFAULT_PRESSURE_LEVEL,
      focusPart: session.focus_part ?? undefined,
      ...context,
    });

    const serviceClient = createServiceRoleClient();

    // Insert the new set before removing the old one, so a failure never leaves an empty session.
    const { data: newTurns, error: insertError } = await serviceClient
      .from("interview_turns")
      .insert(plannedTurnRows(session.id, questions))
      .select("*")
      .order("order_index", { ascending: true });

    if (insertError || !newTurns || newTurns.length === 0) {
      console.error("Failed to insert regenerated interview turns", insertError);
      return NextResponse.json({ error: "Failed to replace the questions" }, { status: 500 });
    }

    // Generation takes a while; if an answer landed meanwhile (another tab), keep the original
    // set and drop the new one rather than leave the session holding both.
    const discardNewTurns = () =>
      serviceClient.from("interview_turns").delete().in("id", newTurns.map((t) => t.id));
    const oldIds = oldTurns.map((t) => t.id);
    const { count: answeredMeanwhile } = await serviceClient
      .from("interview_turns")
      .select("id", { count: "exact", head: true })
      .in("id", oldIds)
      .not("transcript", "is", null);
    if (answeredMeanwhile) {
      await discardNewTurns();
      return NextResponse.json(
        { error: "You've already answered a question, so these questions can't be replaced." },
        { status: 409 }
      );
    }

    const { error: deleteError } = await serviceClient.from("interview_turns").delete().in("id", oldIds);
    if (deleteError) {
      console.error("Failed to remove the old interview turns", deleteError);
      await discardNewTurns();
      return NextResponse.json({ error: "Failed to replace the questions" }, { status: 500 });
    }

    // Question audio is cached per turn; drop the files for turns that no longer exist.
    await serviceClient.storage
      .from("interview-audio")
      .remove(oldIds.map((id) => `${authUserId}/${id}.mp3`))
      .catch(() => {});

    await serviceClient
      .from("interview_sessions")
      .update({ used_fallback_questions: usedFallback })
      .eq("id", session.id);

    return NextResponse.json({ turns: newTurns, usedFallback });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to use AI Interview Prep" }, { status: 403 });
    }
    if (error instanceof PracticeResumeDeletedError) {
      return NextResponse.json({ error: PRACTICE_RESUME_DELETED_MESSAGE }, { status: 409 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("regenerate interview questions error", error);
    return NextResponse.json({ error: "Failed to replace the questions" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
