import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

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

    // 2. Fetch turns (RLS enforces child existence join)
    const { data: turns, error: turnsError } = await supabase
      .from("interview_turns")
      .select("*")
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    if (turnsError) {
      return NextResponse.json({ error: "Failed to load interview turns" }, { status: 500 });
    }

    return NextResponse.json({
      session,
      turns: turns || [],
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

    // "completed" is deliberately excluded: it's only ever set by the turns route after a real
    // Gemini report is generated (see [id]/turns/route.ts step 9). Allowing a client to PATCH
    // straight to "completed" would let a session show as finished with report still null.
    if (!["in_progress", "abandoned"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("interview_sessions")
      .update({ status })
      .eq("id", sessionId)
      .eq("user_id", authUserId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
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
