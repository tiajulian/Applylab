import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { ScoreResumeCombinedError, scoreResumeCombined } from "@/lib/anthropic/scoreResumeCombined";
import { analyzeResume } from "@/lib/resume/contentChecks";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { hashForScoring } from "@/lib/resume/scoreCache";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import {
  assertPaidPlan,
  ContentScoreLimitReachedError,
  PaidFeatureError,
  refundContentScore,
  requireUser,
  reserveContentScore,
  UnauthorizedError,
} from "@/lib/requireUser";
import type { Resume } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

/**
 * Paid-only "Score resume" action (Part F of the token-optimisation pass): combines what used to
 * be two separate calls (ats-score, content-score) into one Haiku call so the resume JSON is
 * sent once instead of twice. Free users never hit this route - they keep using
 * /api/resume/[id]/content-score unchanged, and ATS scoring stays Pro-gated exactly as before.
 * Writes both ats_score-family and content_score-family columns in one update, so a resume
 * scored here reads identically to one scored via the two old routes.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  let reserved = false;

  try {
    const { appUser } = await requireUser();
    assertPaidPlan(appUser);

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
      return NextResponse.json(
        { error: "Resume must be generated before scoring" },
        { status: 400 }
      );
    }
    const resumeContent = sanitizeResumeContent(resumeRow.resume_content);

    const atsHash = hashForScoring(resumeRow.job_description, JSON.stringify(resumeContent));
    const contentHash = hashForScoring(JSON.stringify(resumeContent));

    const atsFresh = resumeRow.ats_score !== null && resumeRow.ats_score_content_hash === atsHash;
    const contentFresh =
      resumeRow.content_score !== null && resumeRow.content_score_content_hash === contentHash;

    if (atsFresh && contentFresh) {
      // fromCache tells the client this didn't reserve/increment content_score_count server-side
      // (the branch below does), so it knows not to optimistically bump its own local count.
      return NextResponse.json({
        ats: {
          score: resumeRow.ats_score,
          missing_keywords: resumeRow.missing_keywords,
          matched_keywords: [],
          feedback: "",
        },
        content: {
          score: resumeRow.content_score,
          breakdown: resumeRow.content_score_breakdown,
          issues: resumeRow.content_score_issues,
        },
        fromCache: true,
      });
    }

    await reserveContentScore(supabase, appUser, resumeRow.id);
    reserved = true;

    const compactJobAd = await getOrParseCompactJobAd(resumeRow.job_description, appUser.id);
    const findings = analyzeResume(resumeContent);
    const { ats, content } = await scoreResumeCombined(compactJobAd, resumeContent, findings, appUser.id);

    // ats_score/content_score-family columns are intentionally not client-writable (see
    // supabase/schema.sql column-privilege lockdown) — ownership was already verified by the
    // RLS-scoped select above, so writing them via service-role here is safe.
    const { error: updateError } = await createServiceRoleClient()
      .from("resumes")
      .update({
        ats_score: ats.score,
        missing_keywords: ats.missing_keywords,
        ats_score_content_hash: atsHash,
        content_score: content.score,
        content_score_breakdown: content.breakdown,
        content_score_issues: content.issues,
        content_score_content_hash: contentHash,
      })
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ats, content });
  } catch (error) {
    if (reserved) {
      await refundContentScore(supabase, params.id).catch((refundError) =>
        console.error("failed to refund content-score reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to score your resume" }, { status: 403 });
    }
    if (error instanceof ContentScoreLimitReachedError) {
      return NextResponse.json({ error: "Content score limit reached for this resume" }, { status: 403 });
    }
    if (error instanceof ScoreResumeCombinedError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("score-combined error", error);
    return NextResponse.json({ error: "Failed to score resume" }, { status: 500 });
  }
}
