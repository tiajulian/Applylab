import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { hashForScoring } from "@/lib/resume/scoreCache";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { sanitizeReviewForPlan, scoreResumeReview } from "@/lib/resume/scoreReview";
import type { Resume, ResumeReviewResult } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { appUser } = await requireUser();
    const supabase = createClient();

    const { data: resume, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;
    if (!resumeRow.resume_content) {
      return NextResponse.json({ error: "Resume has no content" }, { status: 400 });
    }

    const resumeContent = sanitizeResumeContent(resumeRow.resume_content);
    const currentHash = hashForScoring(JSON.stringify(resumeContent));
    const isUnlocked = appUser.plan !== "free";

    if (
      typeof resumeRow.review_overall_score === "number" &&
      resumeRow.review_categories &&
      resumeRow.review_content_hash
    ) {
      const isStale = resumeRow.review_content_hash !== currentHash;
      const rawResult: ResumeReviewResult = {
        overall_score: resumeRow.review_overall_score,
        categories: resumeRow.review_categories,
        findings: resumeRow.review_findings ?? [],
        content_hash: resumeRow.review_content_hash,
        scored_at: resumeRow.review_scored_at ?? resumeRow.created_at,
        unlocked: isUnlocked,
      };

      return NextResponse.json({
        review: sanitizeReviewForPlan(rawResult, isUnlocked),
        isStale,
      });
    }

    return NextResponse.json({ review: null, isStale: false });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/resume/[id]/review error", error);
    return NextResponse.json({ error: "Failed to fetch resume review" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { appUser } = await requireUser();
    const supabase = createClient();

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
      return NextResponse.json({ error: "Resume must have content before reviewing" }, { status: 400 });
    }

    const resumeContent = sanitizeResumeContent(resumeRow.resume_content);
    const contentHash = hashForScoring(JSON.stringify(resumeContent));
    const isUnlocked = appUser.plan !== "free";

    // Hash cache hit check
    if (
      typeof resumeRow.review_overall_score === "number" &&
      resumeRow.review_categories &&
      resumeRow.review_content_hash === contentHash
    ) {
      const cachedResult: ResumeReviewResult = {
        overall_score: resumeRow.review_overall_score,
        categories: resumeRow.review_categories,
        findings: resumeRow.review_findings ?? [],
        content_hash: resumeRow.review_content_hash,
        scored_at: resumeRow.review_scored_at ?? resumeRow.created_at,
        unlocked: isUnlocked,
      };


      return NextResponse.json({
        review: sanitizeReviewForPlan(cachedResult, isUnlocked),
        fromCache: true,
      });
    }

    // Parse job ad if present, otherwise null for generic review mode
    let compactJobAd = null;
    if (resumeRow.job_description && resumeRow.job_description.trim().length > 20) {
      compactJobAd = await getOrParseCompactJobAd(resumeRow.job_description, appUser.id).catch(() => null);
    }

    const fullReview = await scoreResumeReview(resumeContent, compactJobAd, appUser.id, true);

    // Save full review to DB (via service role client due to schema privilege lockdown)
    const { error: updateError } = await createServiceRoleClient()
      .from("resumes")
      .update({
        review_overall_score: fullReview.overall_score,
        review_categories: fullReview.categories,
        review_findings: fullReview.findings,
        review_content_hash: contentHash,
        review_scored_at: fullReview.scored_at,
      })
      .eq("id", params.id);

    if (updateError) {
      console.error("Failed to update resume review row", updateError);
    }

    return NextResponse.json({
      review: sanitizeReviewForPlan(fullReview, isUnlocked),
      fromCache: false,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/resume/[id]/review error", error);
    return NextResponse.json({ error: "Failed to score resume review" }, { status: 500 });
  }
}
