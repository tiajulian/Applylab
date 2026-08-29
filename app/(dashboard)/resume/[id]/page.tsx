import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";
import { GenerationStepper } from "@/components/resume/GenerationStepper";
import { Button } from "@/components/ui/Button";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { Reveal } from "@/components/ui/Reveal";
import type { Resume } from "@/types";

export default async function ResumeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string; fromGeneration?: string };
}) {
  const user = await getCurrentUser();
  const supabase = createClient();

  const [{ data: resume }, { data: existingApplications }] = await Promise.all([
    supabase.from("resumes").select("*").eq("id", params.id).single(),
    // limit(1) rather than maybeSingle(): a resume can have more than one linked application
    // (no unique constraint on resume_id), and maybeSingle() errors out on multiple rows.
    supabase.from("applications").select("id").eq("resume_id", params.id).limit(1),
  ]);

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
      {searchParams?.fromGeneration === "1" && (
        <div className="flex flex-col gap-4">
          <GenerationStepper currentStep={3} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 p-4 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                Resume Generated Successfully
              </span>
              <p className="text-sm font-medium text-ink">
                Run the 5-pillar AI Resume Review to evaluate your ATS parseability, writing quality, and content impact.
              </p>
            </div>
            <Link href={`/resume/${resumeRow.id}/review`}>
              <Button type="button" size="sm">
                View AI Review →
              </Button>
            </Link>
          </div>
        </div>
      )}

      <Reveal>
        <div>
          <h1 className="font-display text-h2 text-ink">
            {resumeRow.job_title || "Untitled role"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{resumeRow.company_name}</p>
          {resumeRow.skills_bridge_id && resumeRow.job_title && (
            <p className="mt-2 text-sm text-accent">
              Tailored to {resumeRow.job_title}. We led with your transferable strengths.
            </p>
          )}
        </div>
      </Reveal>
      <ResumeWorkspace
        resume={resumeRow}
        isPaidPlan={plan !== "free"}
        isTrackedInitially={(existingApplications?.length ?? 0) > 0}
        initialTab={searchParams?.tab === "cover-letter" ? "cover-letter" : "resume"}
      />
    </div>
  );
}
