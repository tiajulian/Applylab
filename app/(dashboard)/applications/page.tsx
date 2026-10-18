import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ApplicationsBoard } from "@/components/applications/ApplicationsBoard";
import { PageHeader } from "@/components/ui/PageHeader";
import { practiceSummaries } from "@/lib/interview/history";
import type { Application, ApplicationInterview } from "@/types";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const [{ data: applications }, { data: resumes }, { data: interviews }, { data: practiceRows }] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("user_id", user!.authUserId)
      .order("applied_date", { ascending: false }),
    supabase
      .from("resumes")
      .select("id, job_title, company_name")
      .eq("user_id", user!.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("application_interviews")
      .select("*, applications!inner(user_id)")
      .eq("applications.user_id", user!.authUserId)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true }),
    // Finished interview practice linked to an application, for "Practised 2 times · ...".
    supabase
      .from("interview_sessions")
      .select("id, created_at, overall_score, application_id")
      .eq("user_id", user!.authUserId)
      .eq("status", "completed")
      .not("application_id", "is", null),
  ]);
  const practiceByApp = Object.fromEntries(practiceSummaries(practiceRows ?? [], (r) => r.application_id));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        step={3}
        title="Applications"
        subtitle="Keep track of every job you've applied for, from sending your resume to getting an offer."
      />
      <ApplicationsBoard
        initialApplications={(applications as Application[]) ?? []}
        resumes={resumes ?? []}
        initialInterviews={(interviews as ApplicationInterview[]) ?? []}
        practiceByApp={practiceByApp}
      />
    </div>
  );
}
