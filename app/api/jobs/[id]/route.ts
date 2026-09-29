import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { isUuid, JOB_COLUMNS, jobsErrorResponse, toJobDto, type JobFields } from "@/lib/jobs/service";
import { toPercent } from "@/lib/jobs/matching/score";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** One job, with whether the current user saved it and their match score/reasons if any. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();
    if (!isUuid(params.id)) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const supabase = createServiceRoleClient();
    const [job, saved, match] = await Promise.all([
      supabase.from("adzuna_jobs").select(JOB_COLUMNS).eq("id", params.id).maybeSingle(),
      supabase
        .from("job_interactions")
        .select("id")
        .eq("user_id", authUserId)
        .eq("job_id", params.id)
        .eq("action", "saved")
        .maybeSingle(),
      supabase.from("job_matches").select("score, reasons").eq("user_id", authUserId).eq("job_id", params.id).maybeSingle(),
    ]);
    for (const result of [job, saved, match]) if (result.error) throw result.error;
    if (!job.data) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const data = job.data as JobFields & { is_active: boolean };
    return NextResponse.json({
      job: toJobDto(data),
      isActive: data.is_active,
      saved: Boolean(saved.data),
      score: match.data ? toPercent(match.data.score) : null,
      reasons: match.data?.reasons ?? [],
    });
  } catch (error) {
    return jobsErrorResponse(error, "get-job", "Failed to load job");
  }
}
