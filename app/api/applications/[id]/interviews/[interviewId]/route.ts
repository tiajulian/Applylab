import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { InterviewStageType, InterviewOutcome } from "@/types";

export const dynamic = "force-dynamic";

const STAGE_TYPES: InterviewStageType[] = [
  "phone_screen",
  "technical",
  "panel",
  "async_video",
  "group",
  "general",
  "coding",
];

const OUTCOME_TYPES: InterviewOutcome[] = ["scheduled", "completed", "cancelled"];

function isValidStage(value: unknown): value is InterviewStageType {
  return typeof value === "string" && (STAGE_TYPES as string[]).includes(value);
}

function isValidOutcome(value: unknown): value is InterviewOutcome {
  return typeof value === "string" && (OUTCOME_TYPES as string[]).includes(value);
}

function isValidTimestamp(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; interviewId: string } }
) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const body = await request.json().catch(() => ({}));
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    // Verify application belongs to caller
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .maybeSingle();

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("stage_type" in body) {
      if (!isValidStage(body.stage_type)) {
        return NextResponse.json({ error: "Invalid stage_type" }, { status: 400 });
      }
      updates.stage_type = body.stage_type;
    }

    if ("scheduled_at" in body) {
      if (!isValidTimestamp(body.scheduled_at)) {
        return NextResponse.json({ error: "Invalid scheduled_at timestamp" }, { status: 400 });
      }
      updates.scheduled_at = new Date(body.scheduled_at).toISOString();
    }

    if ("is_deadline" in body) {
      updates.is_deadline = Boolean(body.is_deadline);
    }

    if ("location" in body) {
      updates.location =
        typeof body.location === "string" ? body.location.trim().slice(0, 500) : null;
    }

    if ("notes" in body) {
      updates.notes =
        typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    }

    if ("outcome" in body) {
      if (!isValidOutcome(body.outcome)) {
        return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
      }
      updates.outcome = body.outcome;
    }

    const { data: interview, error: updateError } = await supabase
      .from("application_interviews")
      .update(updates)
      .eq("id", params.interviewId)
      .eq("application_id", params.id)
      .select()
      .single();

    if (updateError || !interview) {
      return NextResponse.json(
        { error: updateError?.message ?? "Interview round not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ interview });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("patch-interview-round error", error);
    return NextResponse.json({ error: "Failed to update interview round" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; interviewId: string } }
) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    // Verify application belongs to caller
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .maybeSingle();

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("application_interviews")
      .delete()
      .eq("id", params.interviewId)
      .eq("application_id", params.id)
      .select()
      .single();

    if (deleteError || !deleted) {
      return NextResponse.json(
        { error: deleteError?.message ?? "Interview round not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("delete-interview-round error", error);
    return NextResponse.json({ error: "Failed to delete interview round" }, { status: 500 });
  }
}
