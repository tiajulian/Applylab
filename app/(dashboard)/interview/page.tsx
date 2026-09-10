import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { InterviewSetup } from "@/components/interview/InterviewSetup";
import type { Resume, Application, ApplicationInterview } from "@/types";

export const dynamic = "force-dynamic";

export default async function InterviewPage(props: {
  searchParams: Promise<{ application?: string; stage?: string; interview?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();
  const [{ data: resumes }, { data: applications }, { data: interviews }] = await Promise.all([
    supabase
      .from("resumes")
      // InterviewSetup only reads id/job_title/company_name/resume_content (for its readiness
      // score) - dropping cover_letter_content, job_description, pdf_url etc. cuts real payload
      // since this page loads every one of the user's resumes up front for client-side switching.
      .select("id, job_title, company_name, resume_content")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.authUserId),
    supabase
      .from("application_interviews")
      .select("*, applications!inner(user_id)")
      .eq("applications.user_id", user.authUserId),
  ]);

  return (
    <div className="w-full">
      <InterviewSetup
        resumes={(resumes || []) as Resume[]}
        applications={(applications || []) as Application[]}
        interviews={(interviews || []) as ApplicationInterview[]}
        user={user.appUser!}
        initialApplicationId={searchParams.application}
        initialStage={searchParams.stage}
        initialInterviewId={searchParams.interview}
      />
    </div>
  );
}
