import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeResume } from "@/lib/resume/contentChecks";
import { scoreResumeContent } from "@/lib/anthropic/scoreContent";
import {
  ContentScoreLimitReachedError,
  refundContentScore,
  requireUser,
  reserveContentScore,
  UnauthorizedError,
} from "@/lib/requireUser";
import type { Resume } from "@/types";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  let reserved = false;

  try {
    const { appUser } = await requireUser();

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;

    if (!resumeRow.resume_content) {
      return NextResponse.json({ error: "Resume not generated yet" }, { status: 400 });
    }

    await reserveContentScore(supabase, appUser, resumeRow.id);
    reserved = true;

    const findings = analyzeResume(resumeRow.resume_content);
    const result = await scoreResumeContent(resumeRow.resume_content, findings);

    const { error: updateError } = await supabase
      .from("resumes")
      .update({
        content_score: result.score,
        content_score_breakdown: result.breakdown,
        content_score_issues: result.issues,
      })
      .eq("id", params.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      score: result.score,
      breakdown: result.breakdown,
      issues: result.issues,
    });
  } catch (error) {
    if (reserved) {
      await refundContentScore(supabase, params.id).catch((refundError) =>
        console.error("failed to refund content-score reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ContentScoreLimitReachedError) {
      return NextResponse.json(
        { error: "Content score limit reached for this resume — upgrade to re-score" },
        { status: 403 }
      );
    }
    console.error("content-score error", error);
    return NextResponse.json({ error: "Failed to score resume content" }, { status: 500 });
  }
}
