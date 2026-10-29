import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { ScoreResumeCombinedError, scoreResumeCombined } from "@/lib/anthropic/scoreResumeCombined";
import { analyzeResume } from "@/lib/resume/contentChecks";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { resumeScoreHash } from "@/lib/resume/resumeScoreHash";
import { keywordScoreHash } from "@/lib/resume/keywordScoreHash";
import { isContentScoreBreakdown, isKeywordScore, keywordContentKey } from "@/lib/resume/keywordScore";
import { hasReviewJobFacts } from "@/lib/resume/reviewAssessment";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import {
  assertPaidPlan,
  ContentScoreLimitReachedError,
  PaidFeatureError,
  refundContentScore,
  reserveContentScore,
  UnauthorizedError,
  requirePermanentUser,
  unauthorizedResponse,
} from "@/lib/requireUser";
import type { Resume } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

class ScoreSaveError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/**
 * Paid-only "Score resume" action (Part F of the token-optimisation pass): combines what used to
 * be two separate calls (ats-score, content-score) into one Haiku call so the resume JSON is
 * sent once instead of twice. Free users never hit this route - they keep using
 * /api/resume/[id]/content-score unchanged, and ATS scoring stays Pro-gated exactly as before.
 * Writes both ats_score-family and content_score-family columns in one update, so a resume
 * scored here reads identically to one scored via the two old routes.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = createClient();
  let reservedForUserId: string | null = null;

  try {
    const { appUser } = await requirePermanentUser();
    const rateLimited = await enforceRateLimit(`resume-score:${appUser.id}`, 20, 60 * 60_000);
    if (rateLimited) return rateLimited;

    assertPaidPlan(appUser);

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", appUser.id)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume & { review_edit_token?: string; review_job_ad_token?: string };

    if (!resumeRow.resume_content) {
      return NextResponse.json(
        { error: "Resume must be generated before scoring" },
        { status: 400 }
      );
    }
    const resumeContent = sanitizeResumeContent(resumeRow.resume_content);
    if (!resumeRow.job_description?.trim()) {
      return NextResponse.json({ error: "Attach a job ad before checking keyword match.", code: "JOB_AD_REQUIRED" }, { status: 422 });
    }
    const body = await request.json().catch(() => ({}));
    const scoredContentKey = keywordContentKey(resumeContent);
    if (body?.expectedContentKey !== undefined && body.expectedContentKey !== scoredContentKey) {
      return NextResponse.json({ error: "Your latest edits are not saved yet, or the resume changed in another tab. Wait for Saved and try again; reload if it still differs." }, { status: 409 });
    }

    const atsHash = keywordScoreHash(resumeContent, resumeRow.job_description);
    const contentHash = resumeScoreHash(resumeContent);

    const atsFresh = isKeywordScore(resumeRow.ats_score) && resumeRow.ats_score_content_hash === atsHash
      && Array.isArray(resumeRow.missing_keywords) && resumeRow.missing_keywords.every((word) => typeof word === "string" && word.trim());
    const contentFresh =
      isKeywordScore(resumeRow.content_score) && resumeRow.content_score_content_hash === contentHash
      && isContentScoreBreakdown(resumeRow.content_score_breakdown) && Array.isArray(resumeRow.content_score_issues);

    if (atsFresh && contentFresh) {
      // fromCache tells the client this didn't reserve/increment content_score_count server-side
      // (the branch below does), so it knows not to optimistically bump its own local count.
      return NextResponse.json({
        ats: {
          score: resumeRow.ats_score,
          missing_keywords: resumeRow.missing_keywords,
        },
        content: {
          score: resumeRow.content_score,
          breakdown: resumeRow.content_score_breakdown,
          issues: resumeRow.content_score_issues,
        },
        fromCache: true,
        scoredContentKey,
        jobDescription: resumeRow.job_description,
      });
    }

    if (!resumeRow.review_edit_token || !resumeRow.review_job_ad_token) {
      throw new ScoreSaveError("Score saving is temporarily unavailable. Your resume has not been changed.", 503);
    }

    await reserveContentScore(supabase, appUser, resumeRow.id);
    reservedForUserId = appUser.id;

    const compactJobAd = await getOrParseCompactJobAd(resumeRow.job_description, appUser.id, supabase, appUser.plan);
    if (!hasReviewJobFacts(compactJobAd)) {
      throw new ScoreResumeCombinedError("We couldn't identify requirements in this job ad. Check the ad and try again; no score has been saved.");
    }
    const findings = analyzeResume(resumeContent);
    const { ats, content } = await scoreResumeCombined(
      compactJobAd,
      resumeContent,
      findings,
      appUser.id,
      supabase,
      appUser.plan
    );

    // ats_score/content_score-family columns are intentionally not client-writable (see
    // supabase/schema.sql column-privilege lockdown) — ownership was already verified by the
    // RLS-scoped select above, so writing them via service-role here is safe.
    const { data: saved, error: updateError } = await createServiceRoleClient()
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
      .eq("id", params.id)
      .eq("user_id", appUser.id)
      .eq("review_edit_token", resumeRow.review_edit_token)
      .eq("review_job_ad_token", resumeRow.review_job_ad_token)
      .select("id").maybeSingle();

    if (updateError) {
      console.error("Could not save resume scores", updateError);
      throw new ScoreSaveError("We couldn't save the comparison. Please try again.", 503);
    }
    if (!saved) throw new ScoreSaveError("The resume or job ad changed during the comparison. Check again for the latest version.", 409);

    return NextResponse.json({ ats, content, scoredContentKey, jobDescription: resumeRow.job_description, fromCache: false });
  } catch (error) {
    if (reservedForUserId) {
      await refundContentScore(reservedForUserId, params.id).catch((refundError) =>
        console.error("failed to refund content-score reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to score your resume", code: "PAID_PLAN_REQUIRED" }, { status: 403 });
    }
    if (error instanceof ContentScoreLimitReachedError) {
      return NextResponse.json({ error: "The scoring limit for this resume has been reached. Try again later.", code: "SCORE_LIMIT_REACHED" }, { status: 429 });
    }
    if (error instanceof ScoreSaveError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ScoreResumeCombinedError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("score-combined error", error);
    return NextResponse.json({ error: "Failed to score resume" }, { status: 500 });
  }
}
