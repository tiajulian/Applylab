import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { ApplicationsBoard } from "@/components/applications/ApplicationsBoard";
import type { Application } from "@/types";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  const supabase = createClient();

  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user!.authUserId)
    .order("applied_date", { ascending: false });

  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, job_title, company_name")
    .eq("user_id", user!.authUserId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track every role you&apos;ve applied to, from first submission through to offer.
        </p>
      </div>
      <ApplicationsBoard
        initialApplications={(applications as Application[]) ?? []}
        resumes={resumes ?? []}
      />
    </div>
  );
}
