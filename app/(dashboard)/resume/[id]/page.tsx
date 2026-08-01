import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import type { Resume } from "@/types";

export default async function ResumeDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const supabase = createClient();

  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!resume) {
    notFound();
  }

  const plan = user?.appUser?.plan ?? "free";
  // resume_content is stored as jsonb, so a row from before a ResumeContent schema change simply
  // won't have the newer fields - normalize it here rather than let the editor/templates crash
  // on target_titles/tools/projects being undefined instead of an empty array.
  const resumeRow: Resume = {
    ...(resume as Resume),
    resume_content: resume.resume_content ? sanitizeResumeContent(resume.resume_content) : null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {resumeRow.job_title || "Untitled role"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{resumeRow.company_name}</p>
        {resumeRow.skills_bridge_id && resumeRow.job_title && (
          <p className="mt-2 text-sm text-brand-700">
            Tailored to {resumeRow.job_title}. We led with your transferable strengths.
          </p>
        )}
      </div>
      <ResumeWorkspace resume={resumeRow} isPaidPlan={plan !== "free"} />
    </div>
  );
}
