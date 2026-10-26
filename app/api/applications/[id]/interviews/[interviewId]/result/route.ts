import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { OUTCOME_RECHECK_DAYS } from "@/lib/dashboard/followupConfig";
import type { InterviewResult } from "@/types";

export const dynamic = "force-dynamic";

const RESULTS: InterviewResult[] = ["well", "unsure", "no"];

type Params = { params: Promise<{ id: string; interviewId: string }> };

// Both actions run as one database function each (record_interview_result /
// undo_interview_result), so the round and, for "no", the application change together or not at
// all. The functions are SECURITY INVOKER, so RLS decides whose rows these are, and they only
// touch the round if it belongs to the application in the URL.

function errorResponse(error: unknown, action: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error(`${action} error`, error);
  return NextResponse.json({ error: "Failed to update interview round" }, { status: 500 });
}

/** Records how a round went: { result: "well" | "unsure" | "no" }. */
export async function POST(request: Request, props: Params) {
  const params = await props.params;
  try {
    await requireUser();
    const body = await request.json().catch(() => null);
    const result = body?.result;
    if (!RESULTS.includes(result)) {
      return NextResponse.json({ error: "Invalid result" }, { status: 400 });
    }

    const { data, error } = await createClient().rpc("record_interview_result", {
      p_application_id: params.id,
      p_interview_id: params.interviewId,
      p_result: result,
      p_recheck_days: OUTCOME_RECHECK_DAYS,
    });
    if (error) throw error;
    // False: not this user's round, or it's no longer open (already answered elsewhere).
    if (!data) return NextResponse.json({ error: "This interview can't be updated" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "record-interview-result");
  }
}

/** Undo: the round is unanswered again, and an application closed by "no" is reopened. */
export async function DELETE(_request: Request, props: Params) {
  const params = await props.params;
  try {
    await requireUser();
    // Nothing left to undo (already undone elsewhere) is fine: the round is open either way.
    const { error } = await createClient().rpc("undo_interview_result", {
      p_application_id: params.id,
      p_interview_id: params.interviewId,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "undo-interview-result");
  }
}
