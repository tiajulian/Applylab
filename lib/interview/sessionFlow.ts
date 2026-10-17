import { scoreInterviewAnswer, rewriteWithoutClaims, type ScoreAnswerParams, type ScoreAnswerOutput } from "@/lib/gemini/scoreInterviewAnswer";
import { buildEvidence } from "@/lib/interview/evidence";
import { buildHonestyContext, enforceHonesty } from "@/lib/interview/honesty";
import type { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { InterviewEndedReason, InterviewTurn, Resume, UserProfile } from "@/types";

type UserClient = ReturnType<typeof createClient>;
type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/** Still to be asked: not answered and not skipped. */
export const isPendingTurn = (t: Pick<InterviewTurn, "transcript" | "skipped">) => t.transcript === null && !t.skipped;

/** The first pending turn after `after` in session order (a follow-up sits right after its
 *  parent, so it comes first when one was added). */
export function nextPendingTurn(turns: InterviewTurn[], after: Pick<InterviewTurn, "id" | "order_index">): InterviewTurn | null {
  return (
    turns
      .filter((t) => t.id !== after.id && isPendingTurn(t) && t.order_index > after.order_index)
      .sort((a, b) => a.order_index - b.order_index)[0] ?? null
  );
}

export function nextQuestionPayload(turn: InterviewTurn) {
  return {
    id: turn.id,
    order_index: turn.order_index,
    question_type: turn.question_type,
    question_text: turn.question_text,
    is_followup: turn.is_followup,
  };
}

/** Marks an in-progress session finished and its report as waiting to be built. The report is
 *  built separately (POST /sessions/[id]/report), so finishing never waits on it. */
export async function completeSession(serviceClient: ServiceClient, sessionId: string, endedReason: InterviewEndedReason) {
  await serviceClient
    .from("interview_sessions")
    .update({
      status: "completed",
      ended_reason: endedReason,
      report_status: "pending",
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("status", "in_progress");
}

/**
 * Ends a session that has run out of questions (skips) or that the candidate ended. With at
 * least one answer it completes and awaits its report; with none there is nothing to report on,
 * so it is closed as abandoned. Returns whether a report should be built.
 */
export async function finishSession(
  serviceClient: ServiceClient,
  sessionId: string,
  answeredCount: number,
  reason: InterviewEndedReason
): Promise<boolean> {
  if (answeredCount > 0) {
    await completeSession(serviceClient, sessionId, reason);
    return true;
  }
  await serviceClient
    .from("interview_sessions")
    .update({ status: "abandoned", ended_reason: "ended_early", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "in_progress");
  return false;
}

/** Score columns written to interview_turns and interview_turn_attempts alike. */
export function scoredFields(result: ScoreAnswerOutput, answerSource: "voice" | "text", submissionId: string | null) {
  return {
    transcript: result.transcript,
    answer_source: answerSource,
    duration_sec: result.duration_sec > 0 ? result.duration_sec : null,
    wpm: result.wpm > 0 ? result.wpm : null,
    filler_count: result.filler_count,
    star_scores: result.star_scores,
    score_reasons: result.score_reasons,
    biggest_fix: result.biggest_fix,
    what_worked: result.what_worked,
    transcript_spans: result.transcript_spans,
    content_feedback: result.content_feedback,
    delivery_feedback: result.delivery_feedback,
    suggested_answer: result.suggested_answer,
    suggested_answer_sources: result.suggested_answer_sources,
    submission_id: submissionId,
  };
}

/** Profile evidence for scoring and the honesty check. */
export async function loadProfile(supabase: UserClient, authUserId: string): Promise<Partial<UserProfile>> {
  const { data } = await supabase.from("user_profiles").select("*").eq("user_id", authUserId).maybeSingle();
  return (data || {}) as Partial<UserProfile>;
}

/**
 * Scores an answer, then runs the automatic honesty check (section 8.4) on the stronger version
 * and the follow-up. Allowed evidence is the profile, the tailored resume and what the candidate
 * said in this answer. Coding answers are code, not claims, so they skip the check.
 */
export async function scoreAnswerHonestly(
  params: Omit<ScoreAnswerParams, "evidence">,
  profile: Partial<UserProfile>,
  resume: Pick<Resume, "resume_content"> | null
): Promise<ScoreAnswerOutput> {
  const result = await scoreInterviewAnswer({ ...params, evidence: buildEvidence(profile) });
  const isCoding = params.stageType === "coding" || params.questionType === "coding";
  if (isCoding) return result;

  const { work_experience, projects, education, skills, tools } = profile;
  const ctx = buildHonestyContext([
    { work_experience, projects, education, skills, tools },
    resume?.resume_content ?? null,
    result.transcript,
    params.textAnswer ?? "",
    // Naming the job being applied for ("why I want to join Acme") is not a claim about the past.
    params.jobContext.companyName,
    params.jobContext.jobTitle,
  ]);
  const checked = await enforceHonesty(
    {
      suggestedAnswer: result.suggested_answer,
      followupQuestion: result.followup_question,
      questionText: params.questionText,
    },
    ctx,
    (text, banned) => rewriteWithoutClaims(params, text, banned)
  );

  return {
    ...result,
    suggested_answer: checked.suggestedAnswer,
    followup_question: checked.followupQuestion,
    needs_followup: result.needs_followup && checked.followupQuestion !== null,
  };
}
