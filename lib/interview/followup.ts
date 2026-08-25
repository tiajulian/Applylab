/**
 * Adaptive follow-up question logic and session bounding rules.
 */

export const MAX_FOLLOWUPS_PER_QUESTION = 1;
export const MAX_TOTAL_TURNS_PER_SESSION = 8;

export interface FollowupDecisionInput {
  isCurrentTurnFollowup: boolean;
  needsFollowup: boolean;
  followupQuestion?: string | null;
  totalCompletedTurns: number;
}

export interface FollowupDecision {
  shouldFollowup: boolean;
  followupQuestionText: string | null;
  reason: "granted" | "already_followup" | "not_needed" | "missing_question" | "session_turn_cap_reached";
}

/**
 * Evaluates whether an adaptive follow-up question should be injected.
 * Strictly enforces a max 1 follow-up cap per main question and a hard ceiling on session turns.
 */
export function decideFollowup(input: FollowupDecisionInput): FollowupDecision {
  if (input.totalCompletedTurns >= MAX_TOTAL_TURNS_PER_SESSION) {
    return {
      shouldFollowup: false,
      followupQuestionText: null,
      reason: "session_turn_cap_reached",
    };
  }

  if (input.isCurrentTurnFollowup) {
    return {
      shouldFollowup: false,
      followupQuestionText: null,
      reason: "already_followup",
    };
  }

  if (!input.needsFollowup) {
    return {
      shouldFollowup: false,
      followupQuestionText: null,
      reason: "not_needed",
    };
  }

  const cleanedQuestion = input.followupQuestion?.trim();
  if (!cleanedQuestion || cleanedQuestion.length < 5) {
    return {
      shouldFollowup: false,
      followupQuestionText: null,
      reason: "missing_question",
    };
  }

  return {
    shouldFollowup: true,
    followupQuestionText: cleanedQuestion,
    reason: "granted",
  };
}
