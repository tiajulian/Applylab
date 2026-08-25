import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { generateInterviewQuestions } from "@/lib/gemini/generateInterviewQuestions";
import { stageToMode } from "@/lib/interview/mode";
import type { InterviewStageType, UserProfile, ConfirmedBridgeItem, Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID_STAGES: InterviewStageType[] = [
  "phone_screen",
  "technical",
  "panel",
  "async_video",
  "group",
  "general",
];

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const body = await request.json();
    const { resume_id, stage_type } = body;

    if (!resume_id || typeof resume_id !== "string") {
      return NextResponse.json({ error: "resume_id is required" }, { status: 400 });
    }

    if (!stage_type || !VALID_STAGES.includes(stage_type)) {
      return NextResponse.json(
        { error: `Invalid stage_type. Must be one of: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // 1. Verify resume ownership
    const { data: resumeRow, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resume_id)
      .single();

    if (resumeError || !resumeRow) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resume = resumeRow as Resume;

    // 2. Fetch user profile
    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    const profile = (profileRow || {}) as Partial<UserProfile>;

    // 3. Fetch compact job ad cache
    const compactJobAd = await getOrParseCompactJobAd(resume.job_description || "", authUserId);

    // 4. Fetch skills bridge items if attached
    let confirmedBridgeItems: ConfirmedBridgeItem[] = [];
    let gapBridgeItems: { competency: string; target_requirement: string }[] = [];

    if (resume.skills_bridge_id) {
      const { data: bridgeItems } = await supabase
        .from("skills_bridge_items")
        .select("*")
        .eq("bridge_id", resume.skills_bridge_id);

      if (bridgeItems && bridgeItems.length > 0) {
        confirmedBridgeItems = bridgeItems
          .filter((i) => (i.state === "matched" || i.state === "to_confirm") && i.user_state === "confirmed")
          .map((i) => ({
            source_company: i.source_company,
            source_job_title: i.source_job_title,
            competency: i.competency,
            target_requirement: i.target_requirement,
            user_note: i.user_note,
          }));

        gapBridgeItems = bridgeItems
          .filter((i) => i.state === "gap")
          .map((i) => ({
            competency: i.competency,
            target_requirement: i.target_requirement,
          }));
      }
    }

    // 5. Generate structured questions grounded in real evidence
    const plannedQuestions = await generateInterviewQuestions({
      userId: authUserId,
      stageType: stage_type as InterviewStageType,
      jobTitle: resume.job_title || "Target Role",
      companyName: resume.company_name || "Target Company",
      jobDescription: resume.job_description || "",
      compactJobAd,
      profile,
      confirmedBridgeItems,
      gapBridgeItems,
    });

    const serviceClient = createServiceRoleClient();

    // 6. Create interview_sessions row
    const { data: session, error: sessionCreateError } = await serviceClient
      .from("interview_sessions")
      .insert({
        user_id: authUserId,
        resume_id: resume.id,
        stage_type,
        mode: stageToMode(stage_type as InterviewStageType),
        status: "in_progress",
      })
      .select("*")
      .single();

    if (sessionCreateError || !session) {
      console.error("Failed to create interview session", sessionCreateError);
      return NextResponse.json({ error: "Failed to create interview session" }, { status: 500 });
    }

    // 7. Insert planned turns
    const turnsToInsert = plannedQuestions.map((q, idx) => ({
      session_id: session.id,
      order_index: idx + 1,
      question_type: q.question_type,
      question_text: q.interviewer_persona
        ? `[${q.interviewer_persona}] ${q.question_text}`
        : q.question_text,
      is_followup: false,
    }));

    const { data: insertedTurns, error: turnsError } = await serviceClient
      .from("interview_turns")
      .insert(turnsToInsert)
      .select("*")
      .order("order_index", { ascending: true });

    if (turnsError || !insertedTurns) {
      console.error("Failed to insert interview turns", turnsError);
      return NextResponse.json({ error: "Failed to initialize interview turns" }, { status: 500 });
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
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to use AI Interview Prep" }, { status: 403 });
    }
    console.error("create interview session error", error);
    return NextResponse.json({ error: "Failed to start interview session" }, { status: 500 });
  }
}
