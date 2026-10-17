import type { InterviewTurn } from "@/types";

export interface ProgressSegment {
  turnId: string;
  answered: boolean;
  current: boolean;
  /** Follow-ups render as small dots inside their parent's segment. */
  followups: { turnId: string; answered: boolean; current: boolean }[];
}

export interface SessionProgress {
  /** 1-based number of the main question being asked (a follow-up shows its parent's). */
  questionNumber: number;
  /** Main questions only; adding a follow-up never changes it. */
  total: number;
  isFollowup: boolean;
  /** "Question 3 of 8" or "Follow-up to question 3" */
  label: string;
  segments: ProgressSegment[];
}

const isAnswered = (t: InterviewTurn) => t.transcript !== null;

/**
 * Counter and segmented bar for a session. Counts main questions only, so the total stays fixed
 * however many follow-ups get added. `currentTurnId` is the question on screen (or the one whose
 * feedback is showing); null once everything is answered.
 */
export function sessionProgress(turns: InterviewTurn[], currentTurnId: string | null): SessionProgress {
  const ordered = [...turns].sort((a, b) => a.order_index - b.order_index);
  const mains = ordered.filter((t) => !t.is_followup);
  const current = ordered.find((t) => t.id === currentTurnId) ?? null;
  const currentMainId = current ? (current.is_followup ? current.parent_turn_id : current.id) : null;

  const segments: ProgressSegment[] = mains.map((m) => ({
    turnId: m.id,
    answered: isAnswered(m),
    current: m.id === currentMainId,
    followups: ordered
      .filter((f) => f.is_followup && f.parent_turn_id === m.id)
      .map((f) => ({ turnId: f.id, answered: isAnswered(f), current: f.id === currentTurnId })),
  }));

  const currentIndex = segments.findIndex((s) => s.current);
  const questionNumber =
    currentIndex >= 0 ? currentIndex + 1 : Math.min(mains.length, mains.filter(isAnswered).length + 1);
  const isFollowup = Boolean(current?.is_followup);

  return {
    questionNumber,
    total: mains.length,
    isFollowup,
    label: isFollowup ? `Follow-up to question ${questionNumber}` : `Question ${questionNumber} of ${mains.length}`,
    segments,
  };
}
