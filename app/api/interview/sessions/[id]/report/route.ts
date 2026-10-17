import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { assertSessionAccess } from "@/lib/interview/allowance";
import { generateInterviewReport } from "@/lib/gemini/generateInterviewReport";
import { bestAttemptTurns } from "@/lib/interview/attempts";
import { rubricOf } from "@/lib/interview/rubrics";
import type { InterviewReport, InterviewSession, InterviewTurn, InterviewTurnAttempt, Resume } from "@/types";

export const dynamic = "force-dynamic";
// One report-writer call; kept under the client's 90s wait (components/interview/ReportBuilder.tsx).
export const maxDuration = 80;

const REPORTS_PER_HOUR = 10;
/** A build older than this died with its request; it may be retried. */
const BUILD_STALE_MS = (maxDuration + 10) * 1000;

type ReportSession = InterviewSession & { resumes: Pick<Resume, "job_title" | "company_name"> | null };

const isStale = (s: Pick<InterviewSession, "report_started_at">) =>
  !s.report_started_at || Date.now() - new Date(s.report_started_at).getTime() > BUILD_STALE_MS;

async function loadSession(authUserId: string, sessionId: string) {
  const { data } = await createClient()
    .from("interview_sessions")
    .select("*, resumes(job_title, company_name)")
    .eq("id", sessionId)
    .eq("user_id", authUserId)
    .single();
  return data as ReportSession | null;
}

function statusOf(session: ReportSession) {
  // A build that never finished reads as failed so the client offers "Try again".
  return session.report_status === "building" && isStale(session) ? "failed" : session.report_status ?? "pending";
}

function errorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error instanceof PaidFeatureError) {
    return NextResponse.json({ error: "Upgrade to Pro to practise interviews" }, { status: 403 });
  }
  return null;
}

/** Report status, plus the report once it's ready. Polled every 2s while building. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId, appUser } = await requireUser();
    const session = await loadSession(authUserId, params.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    assertSessionAccess(appUser, session);
    const report_status = statusOf(session);
    return NextResponse.json({ report_status, report: report_status === "ready" ? session.report : null });
  } catch (error) {
    const known = errorResponse(error);
    if (known) return known;
    console.error("get interview report error", error);
    return NextResponse.json({ error: "Failed to load the report" }, { status: 500 });
  }
}

/**
 * Builds the report for a finished session. Idempotent: a ready report is returned as is, and a
 * build already running is left to finish (202) rather than started twice. Uses each question's
 * best try for the headline; never asks for anything to be answered again.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId, appUser } = await requireUser();

    const session = await loadSession(authUserId, params.id);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    assertSessionAccess(appUser, session);
    if (session.status !== "completed") {
      return NextResponse.json({ error: "Finish the interview to see your report" }, { status: 400 });
    }
    if (session.report_status === "ready" && session.report) {
      return NextResponse.json({ report_status: "ready", report: session.report });
    }

    const rateLimited = await enforceRateLimit(`interview-report:${authUserId}`, REPORTS_PER_HOUR, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const serviceClient = createServiceRoleClient();
    const staleBefore = new Date(Date.now() - BUILD_STALE_MS).toISOString();
    const { data: claimed } = await serviceClient
      .from("interview_sessions")
      .update({ report_status: "building", report_started_at: new Date().toISOString() })
      .eq("id", session.id)
      .or(`report_status.in.(pending,failed),and(report_status.eq.building,report_started_at.lt.${staleBefore})`)
      .select("id")
      .maybeSingle();
    if (!claimed) return NextResponse.json({ report_status: "building" }, { status: 202 });

    try {
      const [{ data: turnRows }, { data: attemptRows }] = await Promise.all([
        serviceClient.from("interview_turns").select("*").eq("session_id", session.id).order("order_index", { ascending: true }),
        serviceClient.from("interview_turn_attempts").select("*").eq("session_id", session.id),
      ]);
      const turns = (turnRows || []) as InterviewTurn[];
      const attempts = (attemptRows || []) as InterviewTurnAttempt[];
      const best = bestAttemptTurns(turns, attempts);
      const answered = best.filter((t) => t.transcript !== null && !t.skipped);
      if (answered.length === 0) throw new Error("No answered questions to report on");

      const generated = await generateInterviewReport({
        userId: authUserId,
        supabase: createClient(),
        tier: appUser.plan,
        mode: session.mode,
        stageType: session.stage_type,
        jobTitle: session.resumes?.job_title || "Target Role",
        companyName: session.resumes?.company_name || "Target Company",
        turns: answered,
      });

      // Every question in session order, with skipped ones listed (no score) and each answered
      // one carrying its tries, best-try fix and first-try scores.
      const firstById = new Map(turns.map((t) => [t.id, t]));
      const summaryById = new Map(answered.map((t, i) => [t.id, generated.question_summaries[i]]));
      const report: InterviewReport = {
        ...generated,
        question_summaries: best
          .filter((t) => t.transcript !== null || t.skipped)
          .map((t) => {
            const summary = summaryById.get(t.id);
            return {
              order_index: t.order_index,
              question_text: t.question_text,
              question_type: t.question_type,
              star_scores: t.skipped ? null : t.star_scores,
              wpm: t.wpm,
              duration_sec: t.duration_sec,
              filler_count: t.filler_count,
              key_takeaway: summary?.key_takeaway ?? "",
              turn_id: t.id,
              skipped: Boolean(t.skipped),
              tries: t.skipped ? 0 : t.attempt_count ?? 1,
              first_star_scores: firstById.get(t.id)?.star_scores ?? null,
              biggest_fix: t.biggest_fix ?? null,
              rubric: rubricOf(t),
              rubric_scores: t.skipped ? null : t.rubric_scores ?? null,
              first_rubric_scores: firstById.get(t.id)?.rubric_scores ?? null,
            };
          }),
      };

      await serviceClient
        .from("interview_sessions")
        .update({ report, overall_score: report.overall_score, report_status: "ready" })
        .eq("id", session.id);

      return NextResponse.json({ report_status: "ready", report });
    } catch (err) {
      await serviceClient.from("interview_sessions").update({ report_status: "failed" }).eq("id", session.id);
      throw err;
    }
  } catch (error) {
    const known = errorResponse(error);
    if (known) return known;
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("build interview report error", error);
    return NextResponse.json({ report_status: "failed", error: "We couldn't build your report." }, { status: 500 });
  }
}
