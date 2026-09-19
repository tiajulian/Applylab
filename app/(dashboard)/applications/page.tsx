import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ApplicationsBoard } from "@/components/applications/ApplicationsBoard";
import type { Application, ApplicationInterview } from "@/types";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const [{ data: applications }, { data: resumes }, { data: interviews }] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col">
      <ApplicationsBoard
        initialApplications={(applications as Application[]) ?? []}
        resumes={resumes ?? []}
        initialInterviews={(interviews as ApplicationInterview[]) ?? []}
      />
    </div>
  );
}
