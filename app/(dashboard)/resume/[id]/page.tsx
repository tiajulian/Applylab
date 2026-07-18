import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ResumeWorkspace } from "@/components/resume/ResumeWorkspace";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {resume.job_title || "Untitled role"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{resume.company_name}</p>
      </div>
      <ResumeWorkspace resume={resume as Resume} isPaidPlan={plan !== "free"} />
    </div>
  );
}
