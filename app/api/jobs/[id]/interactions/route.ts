import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { INTERACTION_ACTIONS, isUuid, jobsErrorResponse, type InteractionAction } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";

/** Records saved / dismissed / applied_click. Repeating an action is a no-op, not an error. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();

    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    const action = body?.action as InteractionAction;
    if (!INTERACTION_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: "Invalid interaction", fields: { action: `Must be one of: ${INTERACTION_ACTIONS.join(", ")}` } },
        { status: 400 }
      );
    }
    if (!isUuid(params.id)) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const supabase = createServiceRoleClient();
    const { data: job, error: jobError } = await supabase.from("adzuna_jobs").select("id").eq("id", params.id).maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { error } = await supabase
      .from("job_interactions")
      .upsert({ user_id: authUserId, job_id: params.id, action }, { onConflict: "user_id,job_id,action", ignoreDuplicates: true });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jobsErrorResponse(error, "post-job-interaction", "Failed to save interaction");
  }
}
