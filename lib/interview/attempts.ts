import { turnAverage } from "@/lib/interview/rubrics";
import type { InterviewTurn, InterviewTurnAttempt } from "@/types";

/** The scored fields an attempt shares with its turn, applied over the turn. */
export function attemptAsTurn(turn: InterviewTurn, attempt: InterviewTurnAttempt): InterviewTurn {
  return {
    ...turn,
    transcript: attempt.transcript,
    answer_source: attempt.answer_source,
    duration_sec: attempt.duration_sec,
    wpm: attempt.wpm,
    filler_count: attempt.filler_count,
    star_scores: attempt.star_scores,
    rubric_scores: attempt.rubric_scores ?? null,
    score_reasons: attempt.score_reasons,
    biggest_fix: attempt.biggest_fix,
    what_worked: attempt.what_worked,
    transcript_spans: attempt.transcript_spans,
    content_feedback: attempt.content_feedback,
    delivery_feedback: attempt.delivery_feedback,
    suggested_answer: attempt.suggested_answer,
    suggested_answer_sources: attempt.suggested_answer_sources,
  };
}

/**
 * Best attempt per turn (highest average on its rubric; the earliest wins a tie), for the report
 * headline. Turns without attempts, or without a score, come back unchanged. The first attempt stays on
 * the turn row itself, which is what progress over time uses.
 */
export function bestAttemptTurns(turns: InterviewTurn[], attempts: InterviewTurnAttempt[]): InterviewTurn[] {
  const byTurn = new Map<string, InterviewTurnAttempt[]>();
  for (const a of attempts) {
    const list = byTurn.get(a.turn_id);
    if (list) list.push(a);
    else byTurn.set(a.turn_id, [a]);
  }

  return turns.map((turn) => {
    const retries = byTurn.get(turn.id);
    const firstScore = turnAverage(turn);
    if (!retries?.length || firstScore === null) return turn;
    let best = turn;
    let bestScore = firstScore;
    for (const a of [...retries].sort((x, y) => x.attempt_number - y.attempt_number)) {
      const merged = attemptAsTurn(turn, a);
      const score = turnAverage(merged);
      if (score !== null && score > bestScore) {
        best = merged;
        bestScore = score;
      }
    }
    return best;
  });
}
