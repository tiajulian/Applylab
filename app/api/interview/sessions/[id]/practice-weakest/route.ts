import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { bestAttemptTurns } from "@/lib/interview/attempts";
import { turnAverage } from "@/lib/interview/rubrics";
import { plannedTurnRows } from "@/lib/interview/questionContext";
import { PRACTICE_RESUME_DELETED_MESSAGE } from "@/lib/interview/sessionFlow";
import type { InterviewSession, InterviewTurn, InterviewTurnAttempt } from "@/types";

export const dynamic = "force-dynamic";

const WEAKEST_COUNT = 3;

/**
 * New short session from questions already asked: the 3 lowest-scoring answered ones (by best
 * try), or the specific ones passed as turnIds ("Practise this" on one fix). Copies the question
 * text and type, so it needs no AI call to set up.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const rateLimited = await enforceRateLimit(`interview-session:${authUserId}`, 10, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const requested: unknown = body?.turnIds;
    if (
      requested !== undefined &&
      (!Array.isArray(requested) || requested.length === 0 || requested.length > WEAKEST_COUNT || !requested.every((id) => typeof id === "string"))
    ) {
      return NextResponse.json({ error: "turnIds must list 1 to 3 questions" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: sessionRow } = await supabase
      .from("interview_sessions")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .single();
    if (!sessionRow) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const source = sessionRow as InterviewSession;
    if (!source.resume_id && !source.uploaded_resume_id && !source.job_ad_only) {
      return NextResponse.json({ error: PRACTICE_RESUME_DELETED_MESSAGE }, { status: 409 });
    }

    const [{ data: turnRows }, { data: attemptRows }] = await Promise.all([
      supabase.from("interview_turns").select("*").eq("session_id", source.id).order("order_index", { ascending: true }),
      supabase.from("interview_turn_attempts").select("*").eq("session_id", source.id),
    ]);
    const scored = bestAttemptTurns((turnRows || []) as InterviewTurn[], (attemptRows || []) as InterviewTurnAttempt[]).filter(
      (t) => t.transcript !== null && !t.skipped && !t.is_followup && turnAverage(t) !== null
    );

    const picked = Array.isArray(requested)
      ? scored.filter((t) => (requested as string[]).includes(t.id))
      : [...scored].sort((a, b) => turnAverage(a)! - turnAverage(b)!).slice(0, WEAKEST_COUNT);
    if (picked.length === 0) {
      return NextResponse.json({ error: "There are no scored answers to practise again" }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();
    const { data: session, error: createError } = await serviceClient
      .from("interview_sessions")
      .insert({
        user_id: authUserId,
        resume_id: source.resume_id,
        uploaded_resume_id: source.uploaded_resume_id ?? null,
        job_title: source.job_title ?? null,
        company_name: source.company_name ?? null,
        job_description: source.job_description ?? null,
        ...(source.job_ad_only ? { job_ad_only: true } : {}),
        stage_type: source.stage_type,
        mode: source.mode,
        status: "in_progress",
        question_count_target: picked.length,
        used_fallback_questions: false,
        application_id: source.application_id ?? null,
        application_interview_id: source.application_interview_id ?? null,
        story_hints: source.story_hints ?? true,
      })
      .select("id")
      .single();
    if (createError || !session) {
      console.error("Failed to create practice-weakest session", createError);
      return NextResponse.json({ error: "Failed to start the practice" }, { status: 500 });
    }

    // Already-formatted question text (keeps any "[Interviewer]" prefix as is).
    const { error: turnsError } = await serviceClient
      .from("interview_turns")
      .insert(plannedTurnRows(session.id, picked.map((t) => ({ question_type: t.question_type, question_text: t.question_text, suggested_evidence: t.suggested_evidence }))));
    if (turnsError) {
      console.error("Failed to copy practice-weakest questions", turnsError);
      await serviceClient.from("interview_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: "Failed to start the practice" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id, questionCount: picked.length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to practise interviews" }, { status: 403 });
    }
    console.error("practice weakest error", error);
    return NextResponse.json({ error: "Failed to start the practice" }, { status: 500 });
  }
}
