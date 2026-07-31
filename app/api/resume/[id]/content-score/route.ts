import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { analyzeResume } from "@/lib/resume/contentChecks";
import { scoreResumeContent } from "@/lib/anthropic/scoreContent";
import {
  ContentScoreLimitReachedError,
  refundContentScore,
  requireUser,
  reserveContentScore,
  UnauthorizedError,
} from "@/lib/requireUser";
import { hashForScoring } from "@/lib/resume/scoreCache";
import type { Resume } from "@/types";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

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

    const currentHash = hashForScoring(JSON.stringify(resumeRow.resume_content));

    if (resumeRow.content_score !== null && resumeRow.content_score_content_hash === currentHash) {
      return NextResponse.json({
        score: resumeRow.content_score,
        breakdown: resumeRow.content_score_breakdown,
        issues: resumeRow.content_score_issues,
      });
    }

    await reserveContentScore(supabase, appUser, resumeRow.id);
    reserved = true;

    const findings = analyzeResume(resumeRow.resume_content);
    const result = await scoreResumeContent(resumeRow.resume_content, findings, appUser.id);

    // content_score-family columns are intentionally not client-writable (see
    // supabase/schema.sql column-privilege lockdown) — ownership was already verified by the
    // RLS-scoped select above, so writing the score via service-role here is safe.
    const { error: updateError } = await createServiceRoleClient()
      .from("resumes")
      .update({
        content_score: result.score,
        content_score_breakdown: result.breakdown,
        content_score_issues: result.issues,
        content_score_content_hash: currentHash,
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
