import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { JOB_COLUMNS, jobsErrorResponse, toJobDto, type JobFields } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const MAX_SAVED = 200;

/** The user's saved jobs, newest save first. Expired jobs stay listed, flagged isActive: false. */
export async function GET() {
  try {
    const { authUserId } = await requireUser();

    const { data, error } = await createServiceRoleClient()
      .from("job_interactions")
      .select(`saved_at:created_at, adzuna_jobs!inner(${JOB_COLUMNS})`)
      .eq("user_id", authUserId)
      .eq("action", "saved")
      .order("created_at", { ascending: false })
      .limit(MAX_SAVED);
    if (error) throw error;

    const rows = (data ?? []) as unknown as { saved_at: string; adzuna_jobs: JobFields & { is_active: boolean } }[];
    return NextResponse.json({
      jobs: rows.map((row) => ({
        job: toJobDto(row.adzuna_jobs),
        isActive: row.adzuna_jobs.is_active,
        savedAt: row.saved_at,
      })),
    });
  } catch (error) {
    return jobsErrorResponse(error, "get-saved-jobs", "Failed to load saved jobs");
  }
}
