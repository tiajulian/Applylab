import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { assertSessionAccess } from "@/lib/interview/allowance";
import { finishSession, nextPendingTurn, nextQuestionPayload } from "@/lib/interview/sessionFlow";
import { scoringClaimStaleBefore } from "@/lib/interview/answerPayload";
import type { InterviewSession, InterviewTurn } from "@/types";

export const dynamic = "force-dynamic";

/** "Skip question": no confirmation, no score; the report lists it as Skipped. */
export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string; turnId: string }> }
) {
  const params = await props.params;
  try {
    const { authUserId, appUser } = await requireUser();

    const supabase = createClient();
    const { data: sessionRow } = await supabase
      .from("interview_sessions")
      .select("id, status, is_free_allowance")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .single();
    if (!sessionRow) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    assertSessionAccess(appUser, sessionRow as Pick<InterviewSession, "is_free_allowance">);
    if ((sessionRow as Pick<InterviewSession, "status">).status !== "in_progress") {
      return NextResponse.json({ error: "This interview session is already finished" }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();
    // A skip can't cut across an answer that is being scored right now.
    const staleBefore = scoringClaimStaleBefore();
    const { data: skipped } = await serviceClient
      .from("interview_turns")
      .update({ skipped: true })
      .eq("id", params.turnId)
      .eq("session_id", params.id)
      .is("transcript", null)
      .or(`scoring_started_at.is.null,scoring_started_at.lt.${staleBefore}`)
      .select("*")
      .maybeSingle();
    if (!skipped) {
      return NextResponse.json({ error: "This question has already been answered" }, { status: 409 });
    }

    const { data: turnRows } = await serviceClient
      .from("interview_turns")
      .select("*")
      .eq("session_id", params.id);
    const turns = (turnRows || []) as InterviewTurn[];

    const next = nextPendingTurn(turns, skipped as InterviewTurn);
    if (next) return NextResponse.json({ turn: skipped, next_question: nextQuestionPayload(next), done: false });

    const answered = turns.filter((t) => t.transcript !== null).length;
    const reportRequired = await finishSession(serviceClient, params.id, answered, "completed");
    return NextResponse.json({ turn: skipped, done: true, reportRequired });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to practise interviews" }, { status: 403 });
    }
    console.error("skip interview question error", error);
    return NextResponse.json({ error: "Failed to skip the question" }, { status: 500 });
  }
}
