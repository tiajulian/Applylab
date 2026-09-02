import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { InterviewStageType } from "@/types";

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

function isValidStage(value: unknown): value is InterviewStageType {
  return typeof value === "string" && (STAGE_TYPES as string[]).includes(value);
}

function isValidTimestamp(value: unknown): boolean {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    const { data: interviews, error } = await supabase
      .from("application_interviews")
      .select("*")
      .eq("application_id", params.id)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ interviews: interviews ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("get-application-interviews error", error);
    return NextResponse.json({ error: "Failed to load interviews" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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
      .select("*")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .maybeSingle();

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const stageType = body.stage_type;
    if (!isValidStage(stageType)) {
      return NextResponse.json({ error: "Invalid stage_type" }, { status: 400 });
    }

    const scheduledAt = body.scheduled_at;
    if (!isValidTimestamp(scheduledAt)) {
      return NextResponse.json({ error: "Invalid scheduled_at timestamp" }, { status: 400 });
    }

    const isDeadline = stageType === "async_video" && Boolean(body.is_deadline);
    const location = typeof body.location === "string" ? body.location.trim().slice(0, 500) : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;

    // Create interview round
    const { data: interview, error: insertError } = await supabase
      .from("application_interviews")
      .insert({
        application_id: params.id,
        stage_type: stageType,
        scheduled_at: new Date(scheduledAt).toISOString(),
        is_deadline: isDeadline,
        location,
        notes,
        outcome: "scheduled",
      })
      .select()
      .single();

    if (insertError || !interview) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to create interview round" },
        { status: 500 }
      );
    }

    // Side effect: If application is in 'applied' status, move to 'interviewing' in the same flow
    let updatedApplication = application;
    if (application.status === "applied") {
      const { data: appUpdated } = await supabase
        .from("applications")
        .update({ status: "interviewing", updated_at: new Date().toISOString() })
        .eq("id", params.id)
        .eq("user_id", authUserId)
        .select()
        .single();

      if (appUpdated) {
        updatedApplication = appUpdated;
      }
    }

    return NextResponse.json({
      interview,
      application: updatedApplication,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("create-interview-round error", error);
    return NextResponse.json({ error: "Failed to create interview round" }, { status: 500 });
  }
}
