import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreATS } from "@/lib/anthropic/scoreATS";
import { assertPaidPlan, PaidFeatureError, requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { Resume } from "@/types";

export async function POST(request: Request) {
  try {
    const { appUser } = await requireUser();
    assertPaidPlan(appUser);

    const { resumeId } = await request.json();

    if (!resumeId || typeof resumeId !== "string") {
      return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;

    if (!resumeRow.resume_content) {
      return NextResponse.json(
        { error: "Resume must be generated before scoring" },
        { status: 400 }
      );
    }

    const result = await scoreATS(resumeRow.job_description, resumeRow.resume_content);

    const { error: updateError } = await supabase
      .from("resumes")
      .update({ ats_score: result.score, missing_keywords: result.missing_keywords })
      .eq("id", resumeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to use ATS scoring" }, { status: 403 });
    }
    console.error("ats-score error", error);
    return NextResponse.json({ error: "Failed to score resume" }, { status: 500 });
  }
}
