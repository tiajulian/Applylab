import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { finishSession } from "@/lib/interview/sessionFlow";
import { scoringClaimStaleBefore } from "@/lib/interview/answerPayload";

export const dynamic = "force-dynamic";

/**
 * "End interview": finishes now. With at least one answer the session completes (ended_early)
 * and the client goes on to build the report from what was answered; with none it closes with
 * no report.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const supabase = createClient();
    const { data: session } = await supabase
      .from("interview_sessions")
      .select("id, status")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .single();
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "in_progress") {
      return NextResponse.json({ error: "This interview session is already finished" }, { status: 400 });
    }

    // Ending while an answer is still being scored would close the session under it (and could
    // call a session with one answer "nothing answered"), so wait for that answer first.
    const [{ count }, { count: scoring }] = await Promise.all([
      supabase
        .from("interview_turns")
        .select("id", { count: "exact", head: true })
        .eq("session_id", params.id)
        .not("transcript", "is", null),
      supabase
        .from("interview_turns")
        .select("id", { count: "exact", head: true })
        .eq("session_id", params.id)
        .is("transcript", null)
        .gt("scoring_started_at", scoringClaimStaleBefore()),
    ]);
    if (scoring) {
      return NextResponse.json(
        { error: "We're still scoring your last answer. Try again in a moment.", code: "STILL_PROCESSING" },
        { status: 409 }
      );
    }

    const answered = count ?? 0;
    const reportRequired = await finishSession(createServiceRoleClient(), params.id, answered, "ended_early");
    return NextResponse.json({ answered, reportRequired });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to practise interviews" }, { status: 403 });
    }
    console.error("end interview error", error);
    return NextResponse.json({ error: "Failed to end the interview" }, { status: 500 });
  }
}
