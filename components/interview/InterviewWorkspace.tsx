"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QuestionCard } from "@/components/interview/QuestionCard";
import { VoiceRecorder, type AnswerPayload, type SubmitResult } from "@/components/interview/VoiceRecorder";
import { TurnFeedback } from "@/components/interview/TurnFeedback";
import { GroupCoachingView } from "@/components/interview/GroupCoachingView";
import { InterviewReportView } from "@/components/interview/InterviewReportView";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon } from "@/components/ui/icons/LucideIcons";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import { sessionProgress, type SessionProgress } from "@/lib/interview/progress";
import { getAnswerModePreference } from "@/lib/interview/questionDisplayPreference";
import {
  PRESSURE_OPTIONS,
  VIDEO_ANSWER_SEC,
  VIDEO_PREP_SEC,
  isPressureLevel,
  type AnswerMode,
} from "@/lib/interview/setupConstants";
import type { InterviewSession, InterviewTurn, InterviewReport } from "@/types";

export interface InterviewWorkspaceProps {
  initialSession: InterviewSession;
  initialTurns: InterviewTurn[];
}

interface NextQuestion {
  id: string;
  order_index: number;
  question_type: string;
  question_text: string;
  is_followup: boolean;
}

const SUBMIT_ERROR_TEXT = "We couldn't send your answer. It's still here.";
const PRACTICE_QUESTION = "Tell us a little about yourself and what you're looking for in your next role.";

const byOrder = (a: InterviewTurn, b: InterviewTurn) => a.order_index - b.order_index;

const draftKeyFor = (turnId: string) => `applylab:interview:draft:${turnId}`;

/** "Try tailoring again" replaces every turn id; carry a half-typed answer to the new first question. */
function moveDraft(fromTurnId: string | undefined, toTurnId: string | undefined) {
  if (!fromTurnId || !toTurnId) return;
  try {
    const draft = sessionStorage.getItem(draftKeyFor(fromTurnId));
    if (draft) sessionStorage.setItem(draftKeyFor(toTurnId), draft);
    sessionStorage.removeItem(draftKeyFor(fromTurnId));
  } catch {
    // Storage disabled: there was no saved draft to move.
  }
}

function blankTurn(q: NextQuestion, sessionId: string, parentId: string): InterviewTurn {
  return {
    id: q.id,
    session_id: sessionId,
    order_index: q.order_index,
    question_type: q.question_type,
    question_text: q.question_text,
    is_followup: q.is_followup,
    parent_turn_id: parentId,
    transcript: null,
    answer_source: null,
    duration_sec: null,
    wpm: null,
    filler_count: null,
    star_scores: null,
    content_feedback: null,
    delivery_feedback: null,
    suggested_answer: null,
    audio_url: null,
    created_at: new Date().toISOString(),
  };
}

function ProgressStrip({ progress }: { progress: SessionProgress }) {
  const answered = progress.segments.filter((s) => s.answered).length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-ink-secondary">
        <span>{progress.label}</span>
        <span className="text-ink-muted">
          {answered} of {progress.total} answered
        </span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {progress.segments.map((seg) => (
          <div
            key={seg.turnId}
            className={clsx(
              "relative h-1.5 flex-1 rounded-pill",
              seg.answered ? "bg-accent" : seg.current ? "bg-accent/40" : "bg-paper-deep"
            )}
          >
            {seg.followups.length > 0 && (
              <span className="absolute -top-[3px] right-1 flex gap-0.5">
                {seg.followups.map((f) => (
                  <span
                    key={f.turnId}
                    className={clsx(
                      "h-3 w-3 rounded-full border-2 border-surface",
                      f.answered ? "bg-accent" : f.current ? "bg-attention" : "bg-paper-deep"
                    )}
                  />
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InterviewWorkspace({
  initialSession,
  initialTurns,
}: InterviewWorkspaceProps) {
  const [session, setSession] = useState<InterviewSession>(initialSession);
  const [turns, setTurns] = useState<InterviewTurn[]>(() => [...initialTurns].sort(byOrder));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastScoredTurn, setLastScoredTurn] = useState<InterviewTurn | null>(null);
  const [nextQuestionCandidate, setNextQuestionCandidate] = useState<NextQuestion | null>(null);
  const [showGroupCoaching, setShowGroupCoaching] = useState(
    initialSession.stage_type === "group" && initialTurns.every((t) => t.transcript === null)
  );
  // Read after mount: the setup page's "How do you want to answer?" lives in localStorage.
  const [initialMode, setInitialMode] = useState<AnswerMode | null>(null);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateMsg, setRegenerateMsg] = useState<string | null>(null);
  const isVideo = initialSession.stage_type === "async_video";
  const [videoStep, setVideoStep] = useState<"intro" | "practice" | "live">(
    isVideo && initialTurns.every((t) => t.transcript === null) ? "intro" : "live"
  );
  const [practiceFirst, setPracticeFirst] = useState(true);
  const lastFailedSubmissionRef = useRef<string | null>(null);

  useEffect(() => {
    setInitialMode(getAnswerModePreference());
  }, []);

  const completedCount = turns.filter((t) => t.transcript !== null).length;
  const activeTurn = turns.find((t) => t.transcript === null) ?? null;
  const isCompleted = session.status === "completed" || Boolean(session.report);
  const pressureLevel = isPressureLevel(session.pressure_level) ? session.pressure_level : "realistic";
  const toneLabel = PRESSURE_OPTIONS[pressureLevel].interviewerLabel;
  const showFallbackBanner = session.used_fallback_questions && completedCount === 0 && !fallbackDismissed;

  const progress = useMemo(
    () => sessionProgress(turns, lastScoredTurn?.id ?? activeTurn?.id ?? null),
    [turns, lastScoredTurn, activeTurn]
  );

  useEffect(() => {
    if (session.used_fallback_questions && completedCount === 0) {
      trackFunnelEvent("interview_fallback_used", { stage: session.stage_type });
    }
    // Once per session load, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  function applyScoredResponse(data: { turn: InterviewTurn; next_question?: NextQuestion; report?: InterviewReport; done: boolean }) {
    const updatedTurn = data.turn;
    setLastScoredTurn(updatedTurn);

    setTurns((prev) => {
      let next = prev.map((t) => (t.id === updatedTurn.id ? { ...t, ...updatedTurn } : t));
      const q = data.next_question;
      if (q && !next.some((t) => t.id === q.id)) {
        // A new follow-up: mirror the server, which shifted every later turn down by one.
        next = next.map((t) => (t.order_index >= q.order_index ? { ...t, order_index: t.order_index + 1 } : t));
        next.push(blankTurn(q, session.id, updatedTurn.id));
      }
      return next.sort(byOrder);
    });

    if (data.done && data.report) {
      setSession((prev) => ({
        ...prev,
        status: "completed",
        report: data.report as InterviewReport,
        overall_score: data.report!.overall_score,
      }));
    } else {
      setNextQuestionCandidate(data.next_question ?? null);
    }
  }

  /** A 409 means the turn already has an answer (a lost response, or another tab). Load the
   *  stored state and show that answer's feedback instead of leaving the user stuck. */
  async function recoverAnsweredTurn(turnId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}`);
      if (!res.ok) return false;
      const data = (await res.json()) as { session: InterviewSession; turns: InterviewTurn[] };
      const fresh = [...data.turns].sort(byOrder);
      const answered = fresh.find((t) => t.id === turnId && t.transcript !== null);
      if (!answered) return false;
      setSession(data.session);
      setTurns(fresh);
      setLastScoredTurn(answered);
      const next = fresh.find((t) => t.transcript === null) ?? null;
      setNextQuestionCandidate(next);
      return true;
    } catch {
      return false;
    }
  }

  async function handleAnswerSubmit(answer: AnswerPayload): Promise<SubmitResult> {
    if (!activeTurn) return { ok: false, error: SUBMIT_ERROR_TEXT };

    const isRetry = lastFailedSubmissionRef.current === answer.submissionId;
    if (isRetry) trackFunnelEvent("interview_submit_retried", { stage: session.stage_type });

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}/turns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnId: activeTurn.id, ...answer }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 && data.code !== "STILL_PROCESSING" && (await recoverAnsweredTurn(activeTurn.id))) {
          lastFailedSubmissionRef.current = null;
          return { ok: true };
        }
        lastFailedSubmissionRef.current = answer.submissionId;
        trackFunnelEvent("interview_submit_failed", { reason: String(res.status) });
        return { ok: false, error: data.error || SUBMIT_ERROR_TEXT };
      }

      lastFailedSubmissionRef.current = null;
      applyScoredResponse(data);
      trackFunnelEvent("interview_answer_submitted", {
        mode: answer.audioBase64 ? "voice" : "text",
        duration_sec: answer.durationSec ?? null,
      });
      return { ok: true };
    } catch (err) {
      console.error("Turn submission error", err);
      lastFailedSubmissionRef.current = answer.submissionId;
      trackFunnelEvent("interview_submit_failed", { reason: "network" });
      return { ok: false, error: SUBMIT_ERROR_TEXT };
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    setRegenerateMsg(null);
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}/regenerate-questions`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegenerateMsg(data.error || "We couldn't tailor them this time. You can carry on with these.");
        return;
      }
      const fresh = [...(data.turns as InterviewTurn[])].sort(byOrder);
      moveDraft(activeTurn?.id, fresh[0]?.id);
      setTurns(fresh);
      setSession((prev) => ({ ...prev, used_fallback_questions: Boolean(data.usedFallback) }));
      if (data.usedFallback) {
        setRegenerateMsg("We still couldn't tailor every question. You can try again or carry on with these.");
      } else {
        setFallbackDismissed(true);
      }
    } catch {
      setRegenerateMsg("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsRegenerating(false);
    }
  }

  function handleProceedToNext() {
    setLastScoredTurn(null);
    setNextQuestionCandidate(null);
  }

  // 1. Completed Report View
  if (isCompleted && session.report && !lastScoredTurn) {
    return <InterviewReportView session={session} report={session.report} />;
  }

  // 2. Group Coaching Explainer View (if first time in group mode)
  if (showGroupCoaching) {
    return <GroupCoachingView onStartPractice={() => setShowGroupCoaching(false)} />;
  }

  // 3. Recorded video intro: how the timing works, plus an optional unscored practice question
  if (videoStep === "intro") {
    return (
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Recorded video practice</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            Like a real one-way video interview: each question gives you {VIDEO_PREP_SEC} seconds to get ready, then{" "}
            {VIDEO_ANSWER_SEC / 60} minutes to answer. Recording starts and stops by itself. You get one re-take per
            question.
          </p>
          {initialMode === "text" && (
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              You chose to type, so there&apos;s no timer. Aim for about 250-300 words, about 2 minutes spoken. Switch to
              Out loud on any question for the timed version.
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-paper p-4">
          <input
            type="checkbox"
            checked={practiceFirst}
            onChange={(e) => setPracticeFirst(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-accent"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Start with a practice question</span>
            <span className="block text-xs text-ink-muted">Not scored or saved. Most real video interviews offer one too.</span>
          </span>
        </label>
        <div>
          <Button variant="primary" onClick={() => setVideoStep(practiceFirst ? "practice" : "live")}>
            {practiceFirst ? "Start practice question" : "Start the interview"}
          </Button>
        </div>
      </div>
    );
  }

  if (videoStep === "practice" && initialMode) {
    return (
      <div className="flex flex-col gap-6">
        <QuestionCard
          questionText={PRACTICE_QUESTION}
          questionType="motivation"
          progressLabel="Practice question"
          stageType={session.stage_type}
          toneLabel="Not scored"
        />
        <VoiceRecorder
          key="practice"
          stageType={session.stage_type}
          initialMode={initialMode}
          isLoading={false}
          submitLabel="Finish practice"
          onAnswerSubmit={async () => {
            setVideoStep("live");
            return { ok: true };
          }}
        />
      </div>
    );
  }

  // 4. Feedback View on just-answered turn
  if (lastScoredTurn) {
    return (
      <div className="flex flex-col gap-6">
        <ProgressStrip progress={progress} />
        <TurnFeedback
          turn={lastScoredTurn}
          isFollowupNext={Boolean(nextQuestionCandidate?.is_followup)}
          isDone={isCompleted}
          onNext={handleProceedToNext}
        />
      </div>
    );
  }

  // 5. Live Active Question + Voice Recorder View
  if (activeTurn && initialMode) {
    return (
      <div className="flex flex-col gap-6">
        <ProgressStrip progress={progress} />

        {showFallbackBanner && (
          <div role="status" className="flex flex-col gap-3 rounded-lg border border-attention/30 bg-attention-soft p-4">
            <div className="flex items-start gap-2 text-sm text-ink">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
              <p>We couldn&apos;t tailor these questions to your job, so these are general ones.</p>
            </div>
            {regenerateMsg && <p className="text-xs text-ink-secondary">{regenerateMsg}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={handleRegenerate} isLoading={isRegenerating} disabled={completedCount > 0}>
                Try tailoring again
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFallbackDismissed(true)} disabled={isRegenerating}>
                Continue with these
              </Button>
            </div>
          </div>
        )}

        <QuestionCard
          key={activeTurn.id}
          questionText={activeTurn.question_text}
          questionType={activeTurn.question_type}
          progressLabel={progress.label}
          stageType={session.stage_type}
          isFollowup={activeTurn.is_followup}
          toneLabel={toneLabel}
          turnId={activeTurn.id}
        />

        <VoiceRecorder
          key={activeTurn.id}
          onAnswerSubmit={handleAnswerSubmit}
          isLoading={isSubmitting}
          disabled={isRegenerating}
          isCoding={session.stage_type === "coding"}
          stageType={session.stage_type}
          initialMode={initialMode}
          draftKey={draftKeyFor(activeTurn.id)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center text-ink-secondary">
      Loading your interview...
    </div>
  );
}
