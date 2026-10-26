import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/jobs/api";
import { DuplicateResumeForm } from "@/components/resume/DuplicateResumeForm";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Resume } from "@/types";

export const metadata = { title: "Copy resume" };

export default async function DuplicateResumePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isUuid(params.id)) notFound();

  const supabase = createClient();
  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!resume) {
    notFound();
  }

  const resumeRow = resume as Resume;

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-6">
      <PageHeader
        step={2}
        title="Copy for another job"
        subtitle={`Makes a new resume from your ${
          resumeRow.job_title && resumeRow.job_title !== "General resume"
            ? `${resumeRow.job_title}${resumeRow.company_name ? ` (${resumeRow.company_name})` : ""} resume`
            : "general resume"
        }, rewritten for the new job ad. Your original stays as it is.`}
      />
      <DuplicateResumeForm sourceResumeId={resumeRow.id} />
    </div>
  );
}
