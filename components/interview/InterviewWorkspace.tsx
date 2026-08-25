"use client";

import { useState } from "react";
import { QuestionCard } from "@/components/interview/QuestionCard";
import { VoiceRecorder } from "@/components/interview/VoiceRecorder";
import { TurnFeedback } from "@/components/interview/TurnFeedback";
import { GroupCoachingView } from "@/components/interview/GroupCoachingView";
import { InterviewReportView } from "@/components/interview/InterviewReportView";
import type { InterviewSession, InterviewTurn, InterviewReport } from "@/types";

export interface InterviewWorkspaceProps {
  initialSession: InterviewSession;
  initialTurns: InterviewTurn[];
}

export function InterviewWorkspace({
  initialSession,
  initialTurns,
}: InterviewWorkspaceProps) {
  const [session, setSession] = useState<InterviewSession>(initialSession);
  const [turns, setTurns] = useState<InterviewTurn[]>(initialTurns);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastScoredTurn, setLastScoredTurn] = useState<InterviewTurn | null>(null);
  const [nextQuestionCandidate, setNextQuestionCandidate] = useState<any>(null);
  const [showGroupCoaching, setShowGroupCoaching] = useState(
    initialSession.stage_type === "group" && initialTurns.every((t) => t.transcript === null)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Determine active pending turn
  const completedTurns = turns.filter((t) => t.transcript !== null);
  const pendingTurns = turns.filter((t) => t.transcript === null);
  const activeTurn = pendingTurns.length > 0 ? pendingTurns[0] : null;

  // Session is completed if status is completed or report is present
  const isCompleted = session.status === "completed" || Boolean(session.report);

  async function handleAnswerSubmit(answerData: {
    audioBase64?: string;
    mimeType?: string;
    durationSec?: number;
    textAnswer?: string;
  }) {
    if (!activeTurn) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/interview/sessions/${session.id}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turnId: activeTurn.id,
          ...answerData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit answer");
      }

      const updatedTurn = data.turn as InterviewTurn;
      setLastScoredTurn(updatedTurn);

      // Update turns list
      setTurns((prev) => {
        const nextList = prev.map((t) => (t.id === updatedTurn.id ? updatedTurn : t));
        if (data.next_question && !nextList.some((t) => t.id === data.next_question.id)) {
          // If a new follow-up turn was created, insert it
          nextList.splice(updatedTurn.order_index, 0, {
            id: data.next_question.id,
            session_id: session.id,
            order_index: data.next_question.order_index,
            question_type: data.next_question.question_type,
            question_text: data.next_question.question_text,
            is_followup: data.next_question.is_followup,
            parent_turn_id: updatedTurn.id,
            transcript: null,
            answer_source: null,
            duration_sec: null,
            wpm: null,
            filler_count: null,
            star_scores: null,
            content_feedback: null,
            delivery_feedback: null,
            suggested_answer: null,
            created_at: new Date().toISOString(),
          });
        }
        return nextList;
      });

      if (data.done && data.report) {
        setSession((prev) => ({
          ...prev,
          status: "completed",
          report: data.report as InterviewReport,
          overall_score: data.report.overall_score,
        }));
      } else {
        setNextQuestionCandidate(data.next_question);
      }
    } catch (err: any) {
      console.error("Turn submission error", err);
      setErrorMsg(err.message || "Failed to process answer. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleProceedToNext() {
    setLastScoredTurn(null);
    setNextQuestionCandidate(null);
  }

  // 1. Completed Report View
  if (isCompleted && session.report) {
    return <InterviewReportView session={session} report={session.report} />;
  }

  // 2. Group Coaching Explainer View (if first time in group mode)
  if (showGroupCoaching) {
    return <GroupCoachingView onStartPractice={() => setShowGroupCoaching(false)} />;
  }

  // 3. Feedback View on just-answered turn
  if (lastScoredTurn) {
    return (
      <div className="flex flex-col gap-6">
        <TurnFeedback
          turn={lastScoredTurn}
          isFollowupNext={Boolean(nextQuestionCandidate?.is_followup)}
          isDone={isCompleted}
          onNext={handleProceedToNext}
        />
      </div>
    );
  }

  // 4. Live Active Question + Voice Recorder View
  if (activeTurn) {
    return (
      <div className="flex flex-col gap-6">
        <QuestionCard
          questionText={activeTurn.question_text}
          questionType={activeTurn.question_type}
          orderIndex={activeTurn.order_index}
          totalQuestions={turns.length}
          stageType={session.stage_type}
          isFollowup={activeTurn.is_followup}
        />

        {errorMsg && (
          <div className="rounded bg-critical-soft p-3 text-xs text-critical">
            {errorMsg}
          </div>
        )}

        <VoiceRecorder
          onAnswerSubmit={handleAnswerSubmit}
          isLoading={isSubmitting}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center text-ink-secondary">
      Generating interview session...
    </div>
  );
}
