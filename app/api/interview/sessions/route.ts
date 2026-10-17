import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { generateInterviewQuestions } from "@/lib/gemini/generateInterviewQuestions";
import { loadQuestionContext, plannedTurnRows } from "@/lib/interview/questionContext";
import { stageToMode } from "@/lib/interview/mode";
import { FreeInterviewUsedError, claimFreePractice, freePracticesLeft, isFreePlan, refundFreePractice } from "@/lib/interview/allowance";
import {
  DEFAULT_PRESSURE_LEVEL,
  FREE_INTERVIEW_ALLOWANCE,
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
const FOCUS_PARTS = ["situation", "task", "action", "result"] as const;

export async function POST(request: Request) {
  let releaseSlot: (() => Promise<void>) | null = null;
  // Set while a free practice has been taken but no session exists for it yet.
  let unspentClaim: { client: ReturnType<typeof createServiceRoleClient>; user: Parameters<typeof refundFreePractice>[1] } | null = null;
  try {
    const { authUserId, appUser } = await requireUser();
    const rateLimited = await enforceRateLimit(`interview-session:${authUserId}`, 10, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const heavy = await acquireHeavySlots(createServiceRoleClient(), "interview-session", authUserId);
    if ("response" in heavy) return heavy.response;
    releaseSlot = heavy.release;

    // Quick no before any work; the atomic claim below is what really enforces it.
    if (isFreePlan(appUser) && freePracticesLeft(appUser) === 0) throw new FreeInterviewUsedError();

    const body = await request.json();
    const { resume_id, stage_type, pressure_level, application_id, interview_id, story_hints, focus_part } = body;

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
    if (focus_part !== undefined && !FOCUS_PARTS.includes(focus_part)) {
      return NextResponse.json({ error: "Invalid focus_part" }, { status: 400 });
    }
    if ((application_id !== undefined && typeof application_id !== "string") || (interview_id !== undefined && typeof interview_id !== "string")) {
      return NextResponse.json({ error: "Invalid application link" }, { status: 400 });
    }

    // Free: one short Standard practice at Realistic tone, enforced here whatever the client sent.
    const isFree = isFreePlan(appUser);
    const stageType: InterviewStageType = isFree ? FREE_INTERVIEW_ALLOWANCE.stageType : stage_type;
    const pressureLevel = isFree ? FREE_INTERVIEW_ALLOWANCE.pressureLevel : pressure_level ?? DEFAULT_PRESSURE_LEVEL;
    const questionCount = isFree ? FREE_INTERVIEW_ALLOWANCE.questionCount : STAGE_QUESTION_COUNT[stageType];

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

    // 2. Link to the application / scheduled round it's practice for, only after checking both
    // belong to this user (the round must also belong to that application).
    let applicationId: string | null = null;
    let applicationInterviewId: string | null = null;
    if (application_id) {
      const { data: app } = await supabase
        .from("applications")
        .select("id")
        .eq("id", application_id)
        .eq("user_id", authUserId)
        .maybeSingle();
      if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
      applicationId = app.id;
      if (interview_id) {
        const { data: round } = await supabase
          .from("application_interviews")
          .select("id")
          .eq("id", interview_id)
          .eq("application_id", app.id)
          .maybeSingle();
        if (!round) return NextResponse.json({ error: "Interview round not found" }, { status: 404 });
        applicationInterviewId = round.id;
      }
    }

    const serviceClient = createServiceRoleClient();
    if (isFree) {
      await claimFreePractice(serviceClient, appUser);
      unspentClaim = { client: serviceClient, user: appUser };
    }

    // 3. Generate exactly the promised number of questions, grounded in real evidence
    const context = await loadQuestionContext(supabase, authUserId, appUser.plan, resume);
    const { questions, usedFallback } = await generateInterviewQuestions({
      userId: authUserId,
      supabase,
      tier: appUser.plan,
      stageType,
      questionCount,
      pressureLevel,
      focusPart: focus_part,
      ...context,
    });

    // 4. Create interview_sessions row
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
        application_id: applicationId,
        application_interview_id: applicationInterviewId,
        is_free_allowance: isFree,
        // Default on, except Tough (where the hints would give the game away); the setup page
        // sends the user's own choice when they changed it.
        story_hints: typeof story_hints === "boolean" ? story_hints : pressureLevel !== "tough",
        focus_part: focus_part ?? null,
      })
      .select("*")
      .single();

    if (sessionCreateError || !session) {
      console.error("Failed to create interview session", sessionCreateError);
      return NextResponse.json({ error: "Failed to create interview session" }, { status: 500 });
    }
    const spentClaim = unspentClaim;
    unspentClaim = null; // the practice is now spent on a real session

    // 5. Insert planned turns
    const { data: insertedTurns, error: turnsError } = await serviceClient
      .from("interview_turns")
      .insert(plannedTurnRows(session.id, questions))
      .select("*")
      .order("order_index", { ascending: true });

    if (turnsError || !insertedTurns || insertedTurns.length === 0) {
      console.error("Failed to insert interview turns", turnsError);
      // Don't leave an empty session behind (or spend the free practice on it).
      await serviceClient.from("interview_sessions").delete().eq("id", session.id);
      unspentClaim = spentClaim;
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
    if (error instanceof FreeInterviewUsedError) {
      return NextResponse.json(
        {
          error: "You've used your free practice. Pro gives you every interview type, all the questions, retries and progress tracking.",
          code: "FREE_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to use AI Interview Prep" }, { status: 403 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("create interview session error", error);
    return NextResponse.json({ error: "Failed to start interview session" }, { status: 500 });
  } finally {
    // Nothing was created (generation or the insert failed): give the free practice back.
    if (unspentClaim) await refundFreePractice(unspentClaim.client, unspentClaim.user).catch(() => {});
    await releaseSlot?.();
  }
}
