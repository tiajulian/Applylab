import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { assertSessionAccess } from "@/lib/interview/allowance";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId, appUser } = await requireUser();

    const sessionId = params.id;
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const supabase = createClient();

    // 1. Fetch session (RLS enforces user ownership)
    const { data: session, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("*, resumes(id, job_title, company_name, job_description)")
      .eq("id", sessionId)
      .eq("user_id", authUserId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
    }
    assertSessionAccess(appUser, session);

    // 2. Fetch turns (RLS enforces child existence join)
    const [{ data: turns, error: turnsError }, { data: attempts }] = await Promise.all([
      supabase.from("interview_turns").select("*").eq("session_id", sessionId).order("order_index", { ascending: true }),
      supabase.from("interview_turn_attempts").select("*").eq("session_id", sessionId),
    ]);

    if (turnsError) {
      return NextResponse.json({ error: "Failed to load interview turns" }, { status: 500 });
    }

    return NextResponse.json({
      session,
      turns: turns || [],
      attempts: attempts || [],
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to access interview sessions" }, { status: 403 });
    }
    console.error("get interview session error", error);
    return NextResponse.json({ error: "Failed to fetch interview session" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const sessionId = params.id;
    const body = await request.json();
    const { status } = body;

    // The only change a client may make is abandoning a session that's still running. Finishing
    // goes through the turns/skip/end routes (which also queue the report), and a finished or
    // ended session is never reopened, so no answer can land after it closed.
    if (status !== "abandoned") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: updated, error: updateError } = await supabase
      .from("interview_sessions")
      .update({ status })
      .eq("id", sessionId)
      .eq("user_id", authUserId)
      .eq("status", "in_progress")
      .select("id");

    if (updateError) {
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
    }
    if (!updated?.length) {
      return NextResponse.json({ error: "This interview session is already finished" }, { status: 409 });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to update interview sessions" }, { status: 403 });
    }
    console.error("patch interview session error", error);
    return NextResponse.json({ error: "Failed to update interview session" }, { status: 500 });
  }
}

/** Delete a practice from "Your practice" (RLS: own sessions only; turns and tries cascade). Its
 *  cached question audio is removed too. Deleting never gives a free practice back. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { data: turns } = await supabase.from("interview_turns").select("id").eq("session_id", params.id);
    const { data: deleted, error } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .select("id");

    if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    if (!deleted?.length) return NextResponse.json({ error: "Interview session not found" }, { status: 404 });

    const paths = (turns ?? []).map((t) => `${authUserId}/${t.id}.mp3`);
    if (paths.length) {
      await createServiceRoleClient().storage.from("interview-audio").remove(paths).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("delete interview session error", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
