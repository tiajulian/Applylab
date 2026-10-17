/**
 * Adaptive follow-up question logic and session bounding rules.
 */

import type { PressureLevel } from "@/lib/interview/setupConstants";

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
  pressureLevel: PressureLevel;
  /** Score of the answer's "Result" part (Result, Specific reasons or Plan by rubric); null when unscored. */
  outcomeScore?: number | null;
  /** Lowest of the parts a Tough interviewer probes; null when unscored. */
  weakestScore?: number | null;
}

export interface FollowupDecision {
  shouldFollowup: boolean;
  followupQuestionText: string | null;
  reason:
    | "granted"
    | "already_followup"
    | "not_needed"
    | "missing_question"
    | "session_followup_cap_reached"
    | "gentle_result_present";
}

const WEAK_SCORE = 2;

/**
 * Evaluates whether an adaptive follow-up question should be injected: at most one per main
 * question and followUpAllowance(questionCount) per session. Tone changes when one is asked:
 * Gentle only follows up on a missing Result (or its equivalent in other rubrics), Tough also
 * follows up on a weak part even when the scorer didn't flag it. Scores never depend on tone.
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

  const weak = typeof input.weakestScore === "number" && input.weakestScore <= WEAK_SCORE;
  const wanted = input.needsFollowup || (input.pressureLevel === "tough" && weak);
  if (!wanted) return deny("not_needed");

  if (input.pressureLevel === "supportive" && typeof input.outcomeScore === "number" && input.outcomeScore > WEAK_SCORE) {
    return deny("gentle_result_present");
  }

  const cleanedQuestion = input.followupQuestion?.trim();
  if (!cleanedQuestion || cleanedQuestion.length < 5) return deny("missing_question");

  return {
    shouldFollowup: true,
    followupQuestionText: cleanedQuestion,
    reason: "granted",
  };
}
