import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DuplicateResumeForm } from "@/components/resume/DuplicateResumeForm";
import type { Resume } from "@/types";

export default async function DuplicateResumePage({ params }: { params: { id: string } }) {
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Duplicate &amp; tailor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Starting from your resume for {resumeRow.job_title || "this role"}
          {resumeRow.company_name ? ` at ${resumeRow.company_name}` : ""} — tell us about the new
          role and we&apos;ll re-tailor your existing content instead of starting from scratch.
        </p>
      </div>
      <DuplicateResumeForm sourceResumeId={resumeRow.id} />
    </div>
  );
}
