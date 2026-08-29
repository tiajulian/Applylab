import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { hashForScoring } from "@/lib/resume/scoreCache";
import { sanitizeReviewForPlan } from "@/lib/resume/scoreReview";
import { ResumeReviewWorkspace } from "@/components/resume/review/ResumeReviewWorkspace";
import type { Resume, ResumeReviewResult } from "@/types";

export const dynamic = "force-dynamic";

export default async function ResumeReviewPage({
  params,
}: {
  params: { id: string };
}) {
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
    const currentHash = hashForScoring(JSON.stringify(resumeRow.resume_content));
    isStaleInitially = resumeRow.review_content_hash !== currentHash;

    const rawResult: ResumeReviewResult = {
      overall_score: resumeRow.review_overall_score,
      categories: resumeRow.review_categories,
      findings: resumeRow.review_findings ?? [],
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
    />
  );
}
