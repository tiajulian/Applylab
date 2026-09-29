import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { isUuid, jobsErrorResponse } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";

// applied_click is a record of something that happened, so only save and dismiss can be undone.
const UNDOABLE = new Set(["saved", "dismissed"]);

/** Undoes a save or dismiss. Undoing something that isn't there is a no-op. */
export async function DELETE(_request: Request, { params }: { params: { id: string; action: string } }) {
  try {
    const { authUserId } = await requireUser();
    if (!UNDOABLE.has(params.action)) {
      return NextResponse.json(
        { error: "Invalid interaction", fields: { action: "Only saved or dismissed can be undone" } },
        { status: 400 }
      );
    }
    if (!isUuid(params.id)) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { error } = await createServiceRoleClient()
      .from("job_interactions")
      .delete()
      .eq("user_id", authUserId)
      .eq("job_id", params.id)
      .eq("action", params.action);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jobsErrorResponse(error, "delete-job-interaction", "Failed to undo interaction");
  }
}
