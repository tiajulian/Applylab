import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";
import type { FeedbackStatus } from "@/types";

export const dynamic = "force-dynamic";

const STATUS_VALUES: FeedbackStatus[] = ["new", "reviewing", "planned", "done", "declined"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => ({}));
    const status = body.status;

    if (typeof status !== "string" || !STATUS_VALUES.includes(status as FeedbackStatus)) {
      return NextResponse.json(
        { error: "status must be one of new, reviewing, planned, done, declined" },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const { data: feedback, error } = await supabase
      .from("feedback")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single();

    if (error || !feedback) {
      return NextResponse.json({ error: error?.message ?? "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin-update-feedback error", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
