import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { generateInterviewQuestions } from "@/lib/gemini/generateInterviewQuestions";
import { loadQuestionContext, plannedTurnRows } from "@/lib/interview/questionContext";
import { stageToMode } from "@/lib/interview/mode";
import {
  DEFAULT_PRESSURE_LEVEL,
  STAGE_QUESTION_COUNT,
  isPressureLevel,
} from "@/lib/interview/setupConstants";
import type { InterviewStageType, Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID_STAGES: InterviewStageType[] = [
  "phone_screen",
  "technical",
  "panel",
  "async_video",
  "group",
  "general",
  "coding",
];

export async function POST(request: Request) {
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser();
    const rateLimited = await enforceRateLimit(`interview-session:${authUserId}`, 10, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const heavy = await acquireHeavySlots(createServiceRoleClient(), "interview-session", authUserId);
    if ("response" in heavy) return heavy.response;
    releaseSlot = heavy.release;

    assertPaidPlan(appUser);

    const body = await request.json();
    const { resume_id, stage_type, pressure_level } = body;

    if (!resume_id || typeof resume_id !== "string") {
      return NextResponse.json({ error: "resume_id is required" }, { status: 400 });
    }

    if (!stage_type || !VALID_STAGES.includes(stage_type)) {
      return NextResponse.json(
        { error: `Invalid stage_type. Must be one of: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    if (pressure_level !== undefined && !isPressureLevel(pressure_level)) {
      return NextResponse.json({ error: "Invalid pressure_level" }, { status: 400 });
    }
    const pressureLevel = pressure_level ?? DEFAULT_PRESSURE_LEVEL;
    const stageType = stage_type as InterviewStageType;
    const questionCount = STAGE_QUESTION_COUNT[stageType];

    const supabase = createClient();

    // 1. Verify resume ownership (RLS)
    const { data: resumeRow, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resume_id)
      .single();

    if (resumeError || !resumeRow) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resume = resumeRow as Resume;

    // 2. Generate exactly the promised number of questions, grounded in real evidence
    const context = await loadQuestionContext(supabase, authUserId, appUser.plan, resume);
    const { questions, usedFallback } = await generateInterviewQuestions({
      userId: authUserId,
      supabase,
      tier: appUser.plan,
      stageType,
      questionCount,
      pressureLevel,
      ...context,
    });

    const serviceClient = createServiceRoleClient();

    // 3. Create interview_sessions row
    const { data: session, error: sessionCreateError } = await serviceClient
      .from("interview_sessions")
      .insert({
        user_id: authUserId,
        resume_id: resume.id,
        stage_type: stageType,
        mode: stageToMode(stageType),
        status: "in_progress",
        pressure_level: pressureLevel,
        question_count_target: questionCount,
        used_fallback_questions: usedFallback,
      })
      .select("*")
      .single();

    if (sessionCreateError || !session) {
      console.error("Failed to create interview session", sessionCreateError);
      return NextResponse.json({ error: "Failed to create interview session" }, { status: 500 });
    }

    // 4. Insert planned turns
    const { data: insertedTurns, error: turnsError } = await serviceClient
      .from("interview_turns")
      .insert(plannedTurnRows(session.id, questions))
      .select("*")
      .order("order_index", { ascending: true });

    if (turnsError || !insertedTurns || insertedTurns.length === 0) {
      console.error("Failed to insert interview turns", turnsError);
      return NextResponse.json({ error: "Failed to initialise interview turns" }, { status: 500 });
    }

    const firstQuestion = insertedTurns[0];

    return NextResponse.json({
      sessionId: session.id,
      firstQuestion: {
        id: firstQuestion.id,
        order_index: firstQuestion.order_index,
        question_type: firstQuestion.question_type,
        question_text: firstQuestion.question_text,
        is_followup: firstQuestion.is_followup,
      },
      totalPlanned: insertedTurns.length,
      usedFallback,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to use AI Interview Prep" }, { status: 403 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("create interview session error", error);
    return NextResponse.json({ error: "Failed to start interview session" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
