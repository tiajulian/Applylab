import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { scoreATS } from "@/lib/anthropic/scoreATS";
import { assertPaidPlan, PaidFeatureError, requireUser, UnauthorizedError } from "@/lib/requireUser";
import { hashForScoring } from "@/lib/resume/scoreCache";
import type { Resume } from "@/types";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

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

    const currentHash = hashForScoring(resumeRow.job_description, JSON.stringify(resumeRow.resume_content));

    if (resumeRow.ats_score !== null && resumeRow.ats_score_content_hash === currentHash) {
      return NextResponse.json({
        result: {
          score: resumeRow.ats_score,
          missing_keywords: resumeRow.missing_keywords,
          matched_keywords: [],
          feedback: "",
        },
      });
    }

    const result = await scoreATS(resumeRow.job_description, resumeRow.resume_content, appUser.id);

    // ats_score/content_score-family columns are intentionally not client-writable (see
    // supabase/schema.sql column-privilege lockdown) — ownership was already verified by the
    // RLS-scoped select above, so writing the score via service-role here is safe.
    const { error: updateError } = await createServiceRoleClient()
      .from("resumes")
      .update({
        ats_score: result.score,
        missing_keywords: result.missing_keywords,
        ats_score_content_hash: currentHash,
      })
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
