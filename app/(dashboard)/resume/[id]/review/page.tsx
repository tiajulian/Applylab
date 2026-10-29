import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/jobs/api";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { resumeReviewHash } from "@/lib/resume/reviewCache";
import { sanitizeReviewForPlan } from "@/lib/resume/scoreReview";
import { withReviewSpelling } from "@/lib/resume/reviewSpelling";
import { fetchReviewSkillGap } from "@/lib/resume/fetchReviewSkillGap";
import { ResumeReviewWorkspace } from "@/components/resume/review/ResumeReviewWorkspace";
import type { Resume, ResumeReviewResult } from "@/types";

export const metadata = { title: "Check & improve" };

export const dynamic = "force-dynamic";

export default async function ResumeReviewPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  if (!isUuid(params.id)) notFound();

  const user = await getCurrentUser();
  const supabase = createClient();

  const { data: resume, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !resume) {
    notFound();
  }

  const plan = user?.appUser?.plan ?? "free";
  const isPaidPlan = plan !== "free";

  const resumeRow: Resume = {
    ...(resume as Resume),
    resume_content: resume.resume_content ? sanitizeResumeContent(resume.resume_content) : null,
  };

  let initialReview: ResumeReviewResult | null = null;
  let isStaleInitially = false;

  if (
    resumeRow.resume_content &&
    typeof resumeRow.review_overall_score === "number" &&
    resumeRow.review_categories &&
    resumeRow.review_content_hash
  ) {
    const currentHash = resumeReviewHash(resumeRow.resume_content, resumeRow.job_description);
    isStaleInitially = resumeRow.review_content_hash !== currentHash;

    const rawResult: ResumeReviewResult = {
      overall_score: resumeRow.review_overall_score,
      categories: resumeRow.review_categories,
      findings: await withReviewSpelling(resumeRow.resume_content, resumeRow.review_findings ?? []),
      content_hash: resumeRow.review_content_hash,
      scored_at: resumeRow.review_scored_at ?? resumeRow.created_at,
      unlocked: isPaidPlan,
    };

    initialReview = sanitizeReviewForPlan(rawResult, isPaidPlan);
  }

  return (
    <ResumeReviewWorkspace
      resume={resumeRow}
      initialReview={initialReview}
      isPaidPlan={isPaidPlan}
      isStaleInitially={isStaleInitially}
      skillGap={user?.authUserId ? await fetchReviewSkillGap(supabase, resumeRow, user.authUserId) : null}
    />
  );
}
