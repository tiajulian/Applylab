/**
 * Adaptive follow-up question logic and session bounding rules.
 */


export const MAX_FOLLOWUPS_PER_QUESTION = 1;

/** Follow-ups a session may add on top of its main questions. They never count toward the
 *  main total ("Question 3 of 8" stays "of 8"). */
export function followUpAllowance(questionCount: number): number {
  return Math.ceil(Math.max(0, questionCount) / 2);
}

export interface FollowupDecisionInput {
  isCurrentTurnFollowup: boolean;
  needsFollowup: boolean;
  followupQuestion?: string | null;
  /** Follow-up turns already in the session. */
  followupsSoFar: number;
  /** Main questions the session was planned with. */
  questionCount: number;
}

export interface FollowupDecision {
  shouldFollowup: boolean;
  followupQuestionText: string | null;
  reason:
    | "granted"
    | "already_followup"
    | "not_needed"
    | "missing_question"
    | "session_followup_cap_reached";
}

/**
 * Evaluates whether an adaptive follow-up question should be injected: at most one per main
 * question and followUpAllowance(questionCount) per session.
 */
export function decideFollowup(input: FollowupDecisionInput): FollowupDecision {
  const deny = (reason: FollowupDecision["reason"]): FollowupDecision => ({
    shouldFollowup: false,
    followupQuestionText: null,
    reason,
  });

  if (input.followupsSoFar >= followUpAllowance(input.questionCount)) {
    return deny("session_followup_cap_reached");
  }

  if (input.isCurrentTurnFollowup) return deny("already_followup");

  if (!input.needsFollowup) return deny("not_needed");

  const cleanedQuestion = input.followupQuestion?.trim();
  if (!cleanedQuestion || cleanedQuestion.length < 5) return deny("missing_question");

  return {
    shouldFollowup: true,
    followupQuestionText: cleanedQuestion,
    reason: "granted",
  };
}
