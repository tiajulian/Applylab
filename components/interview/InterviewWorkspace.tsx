"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionCard } from "@/components/interview/QuestionCard";
import { VoiceRecorder, type AnswerPayload, type RecorderPhase, type SubmitResult } from "@/components/interview/VoiceRecorder";
import { StoryHints } from "@/components/interview/StoryHints";
import { saveMicConsent } from "@/components/interview/MicConsentCard";
import { TurnFeedback } from "@/components/interview/TurnFeedback";
import { GroupCoachingView } from "@/components/interview/GroupCoachingView";
import { InterviewReportView } from "@/components/interview/InterviewReportView";
import { ReportBuilder } from "@/components/interview/ReportBuilder";
import { StructureHelper } from "@/components/interview/StructureHelper";
import { Button } from "@/components/ui/Button";
import { FOCUS_SESSION_EVENT } from "@/lib/interview/focusSession";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AlertTriangleIcon } from "@/components/ui/icons/LucideIcons";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import { sessionProgress, type SessionProgress } from "@/lib/interview/progress";
import { attemptAsTurn, bestAttemptTurns } from "@/lib/interview/attempts";
import { MAX_RETRIES_PER_TURN } from "@/lib/interview/scoreLabels";
import { sessionJob } from "@/lib/interview/uploadedResume";
import { getAnswerModePreference } from "@/lib/interview/questionDisplayPreference";
import {
  PRESSURE_OPTIONS,
  VIDEO_ANSWER_SEC,
  VIDEO_PREP_SEC,
  isPressureLevel,
  type AnswerMode,
} from "@/lib/interview/setupConstants";
import type { InterviewSession, InterviewTurn, InterviewTurnAttempt, InterviewReport, Resume } from "@/types";

export interface InterviewWorkspaceProps {
  initialSession: InterviewSession;
  initialTurns: InterviewTurn[];
  initialAttempts?: InterviewTurnAttempt[];
  previousOverallScore?: number | null;
  /** Free plan (its one practice): no retries, and an upgrade card after the report. */
  isFree?: boolean;
  /** The user already agreed to answers being sent for scoring (users.mic_consent_at). */
  initialMicConsented?: boolean;
}

interface NextQuestion {
  id: string;
  order_index: number;
  question_type: string;
  question_text: string;
  is_followup: boolean;
}

/** Feedback on screen: the answer shown, the try before it (for deltas) and its question. */
interface ShownFeedback {
  turnId: string;
  shown: InterviewTurn;
  previous: InterviewTurn | null;
}

const SUBMIT_ERROR_TEXT = "We couldn't send your answer. It's still here.";
const PRACTICE_QUESTION = "Tell us a little about yourself and what you're looking for in your next role.";

const byOrder = (a: InterviewTurn, b: InterviewTurn) => a.order_index - b.order_index;
const isPending = (t: InterviewTurn) => t.transcript === null && !t.skipped;

const draftKeyFor = (turnId: string, attempt = 1) =>
  `applylab:interview:draft:${turnId}${attempt > 1 ? `:try${attempt}` : ""}`;

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

function ProgressBarSegments({ progress }: { progress: SessionProgress }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {progress.segments.map((seg) => (
        <div
          key={seg.turnId}
          className={clsx(
            "relative h-1.5 flex-1 rounded-pill",
            seg.answered ? "bg-accent" : seg.skipped ? "bg-ink-muted/30" : seg.current ? "bg-accent/40" : "bg-paper-deep"
          )}
        >
          {seg.followups.length > 0 && (
            <span className="absolute -top-[3px] right-1 flex gap-0.5">
              {seg.followups.map((f) => (
                <span
                  key={f.turnId}
                  className={clsx(
                    "h-3 w-3 rounded-full border-2 border-paper",
                    f.answered ? "bg-accent" : f.current ? "bg-attention" : "bg-paper-deep"
                  )}
                />
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Focused-session top bar: which job, how tough, how far, and a way out. */
function SessionTopBar({
  jobLine,
  toneLabel,
  progress,
  onEnd,
}: {
  jobLine: string;
  toneLabel: string;
  progress: SessionProgress | null;
  onEnd?: () => void;
}) {
  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-border bg-paper/95 px-4 py-3 backdrop-blur-[10px] sm:mx-0 sm:rounded-lg sm:border sm:px-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{jobLine}</span>
          <span className="hidden shrink-0 rounded-pill bg-paper-deep px-2 py-0.5 text-xs font-medium text-ink-secondary sm:inline">
            {toneLabel}
          </span>
        </div>
        {progress && <span className="shrink-0 text-xs font-medium text-ink-secondary">{progress.label}</span>}
        {onEnd && (
          <button
            type="button"
            onClick={onEnd}
            className="shrink-0 rounded px-1 text-sm font-semibold text-ink-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            End interview
          </button>
        )}
      </div>
      {progress && progress.total > 0 && (
        <div className="mt-2">
          <ProgressBarSegments progress={progress} />
        </div>
      )}
    </div>
  );
}

export function InterviewWorkspace({
  initialSession,
  initialTurns,
  initialAttempts = [],
  previousOverallScore = null,
  isFree = false,
  initialMicConsented = false,
}: InterviewWorkspaceProps) {
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession>(initialSession);
  const [turns, setTurns] = useState<InterviewTurn[]>(() => [...initialTurns].sort(byOrder));
  const [attempts, setAttempts] = useState<InterviewTurnAttempt[]>(initialAttempts);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ShownFeedback | null>(null);
  const [nextQuestionCandidate, setNextQuestionCandidate] = useState<NextQuestion | null>(null);
  const [retryTurnId, setRetryTurnId] = useState<string | null>(null);
  const [showGroupCoaching, setShowGroupCoaching] = useState(
    initialSession.stage_type === "group" && initialTurns.every((t) => t.transcript === null)
  );
  // Read after mount: the setup page's "How do you want to answer?" lives in localStorage.
  const [initialMode, setInitialMode] = useState<AnswerMode | null>(null);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateMsg, setRegenerateMsg] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isVideo = initialSession.stage_type === "async_video";
  const [videoStep, setVideoStep] = useState<"intro" | "practice" | "live">(
    isVideo && initialTurns.every((t) => t.transcript === null) ? "intro" : "live"
  );
  const [practiceFirst, setPracticeFirst] = useState(true);
  const [micConsented, setMicConsented] = useState(initialMicConsented);
  const [recorderPhase, setRecorderPhase] = useState<RecorderPhase>("idle");
  const lastFailedSubmissionRef = useRef<string | null>(null);

  useEffect(() => {
    setInitialMode(getAnswerModePreference());
  }, []);

  // Keep the app menu hidden only while the session is live (not on its report).
  const isLive = session.status === "in_progress";
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(FOCUS_SESSION_EVENT, { detail: isLive }));
  }, [isLive]);

  const job = sessionJob(session as InterviewSession & { resumes?: Pick<Resume, "job_title" | "company_name"> | null });
  const jobLine = [job.jobTitle || "Interview practice", job.companyName].filter(Boolean).join(" · ");
  const answeredCount = turns.filter((t) => t.transcript !== null).length;
  const activeTurn = turns.find(isPending) ?? null;
  const retryTurn = retryTurnId ? turns.find((t) => t.id === retryTurnId) ?? null : null;
  const isCompleted = session.status === "completed";
  const pressureLevel = isPressureLevel(session.pressure_level) ? session.pressure_level : "realistic";
  const toneLabel = PRESSURE_OPTIONS[pressureLevel].interviewerLabel;
  const showFallbackBanner = session.used_fallback_questions && answeredCount === 0 && !fallbackDismissed;

  const attemptsFor = (turnId: string) =>
    attempts.filter((a) => a.turn_id === turnId).sort((a, b) => a.attempt_number - b.attempt_number);
  const triesUsed = (turnId: string) => 1 + attemptsFor(turnId).length;
  const triesLeft = (turnId: string) => Math.max(0, 1 + MAX_RETRIES_PER_TURN - triesUsed(turnId));
  // Retries stop once the report exists: it's the record of this session. They're a Pro feature.
  const retriesOpen = !isFree && session.report_status !== "ready" && session.report_status !== "building";

  const consentProps = {
    needsMicConsent: !micConsented,
    onMicConsent: async () => {
      await saveMicConsent();
      setMicConsented(true);
    },
  };

  const progress = useMemo(
    () => sessionProgress(turns, feedback?.turnId ?? retryTurnId ?? activeTurn?.id ?? null),
    [turns, feedback, retryTurnId, activeTurn]
  );

  useEffect(() => {
    if (session.used_fallback_questions && answeredCount === 0) {
      trackFunnelEvent("interview_fallback_used", { stage: session.stage_type });
    }
    // Once per session load, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  function markCompleted() {
    setSession((prev) => ({ ...prev, status: "completed", report_status: prev.report_status === "ready" ? "ready" : "pending" }));
  }

  function applyScoredResponse(data: { turn: InterviewTurn; next_question?: NextQuestion; done: boolean }) {
    const updatedTurn = data.turn;
    setFeedback({ turnId: updatedTurn.id, shown: updatedTurn, previous: null });

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

    if (data.done) markCompleted();
    setNextQuestionCandidate(data.next_question ?? null);
  }

  /** A 409 means the turn already has an answer (a lost response, or another tab). Load the
   *  stored state and show that answer's feedback instead of leaving the user stuck. */
  async function recoverAnsweredTurn(turnId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}`);
      if (!res.ok) return false;
      const data = (await res.json()) as { session: InterviewSession; turns: InterviewTurn[]; attempts: InterviewTurnAttempt[] };
      const fresh = [...data.turns].sort(byOrder);
      const answered = fresh.find((t) => t.id === turnId && t.transcript !== null);
      if (!answered) return false;
      setSession(data.session);
      setTurns(fresh);
      setAttempts(data.attempts ?? []);
      setFeedback({ turnId, shown: answered, previous: null });
      setNextQuestionCandidate(fresh.find(isPending) ?? null);
      return true;
    } catch {
      return false;
    }
  }

  async function postAnswer(url: string, body: Record<string, unknown>, answer: AnswerPayload) {
    if (lastFailedSubmissionRef.current === answer.submissionId) {
      trackFunnelEvent("interview_submit_retried", { stage: session.stage_type });
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...answer }),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function failed(answer: AnswerPayload, reason: string, message?: string): SubmitResult {
    lastFailedSubmissionRef.current = answer.submissionId;
    trackFunnelEvent("interview_submit_failed", { reason });
    return { ok: false, error: message || SUBMIT_ERROR_TEXT };
  }

  async function handleAnswerSubmit(answer: AnswerPayload): Promise<SubmitResult> {
    if (!activeTurn) return { ok: false, error: SUBMIT_ERROR_TEXT };
    setIsSubmitting(true);
    try {
      const { res, data } = await postAnswer(`/api/interview/sessions/${session.id}/turns`, { turnId: activeTurn.id }, answer);
      if (!res.ok) {
        if (res.status === 409 && data.code !== "STILL_PROCESSING" && (await recoverAnsweredTurn(activeTurn.id))) {
          lastFailedSubmissionRef.current = null;
          return { ok: true };
        }
        return failed(answer, String(res.status), data.error);
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
      return failed(answer, "network");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRetrySubmit(answer: AnswerPayload): Promise<SubmitResult> {
    if (!retryTurn) return { ok: false, error: SUBMIT_ERROR_TEXT };
    setIsSubmitting(true);
    try {
      const { res, data } = await postAnswer(
        `/api/interview/sessions/${session.id}/turns/${retryTurn.id}/attempts`,
        {},
        answer
      );
      if (!res.ok) return failed(answer, String(res.status), data.error);
      lastFailedSubmissionRef.current = null;

      const attempt = data.attempt as InterviewTurnAttempt;
      const prior = attemptsFor(retryTurn.id).filter((a) => a.attempt_number < attempt.attempt_number).pop();
      setAttempts((prev) => (prev.some((a) => a.id === attempt.id) ? prev : [...prev, attempt]));
      setFeedback({
        turnId: retryTurn.id,
        shown: attemptAsTurn(retryTurn, attempt),
        previous: prior ? attemptAsTurn(retryTurn, prior) : retryTurn,
      });
      setRetryTurnId(null);
      trackFunnelEvent("interview_answer_submitted", { mode: answer.audioBase64 ? "voice" : "text", retry: true });
      return { ok: true };
    } catch (err) {
      console.error("Retry submission error", err);
      return failed(answer, "network");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startRetry() {
    if (!feedback) return;
    trackFunnelEvent("interview_retry_started", { try: triesUsed(feedback.turnId) + 1 });
    setRetryTurnId(feedback.turnId);
    setFeedback(null);
  }

  async function handleSkip() {
    if (!activeTurn) return;
    setIsSkipping(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}/turns/${activeTurn.id}/skip`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't skip that question");
      trackFunnelEvent("interview_question_skipped");
      setTurns((prev) => prev.map((t) => (t.id === activeTurn.id ? { ...t, skipped: true } : t)));
      if (data.done) {
        if (data.reportRequired) markCompleted();
        else router.push("/interview");
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSkipping(false);
    }
  }

  async function handleEnd() {
    setIsEnding(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}/end`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't end the interview");
      trackFunnelEvent("interview_ended_early", {
        answered: data.answered,
        total: session.question_count_target ?? progress.total,
      });
      setConfirmingEnd(false);
      if (data.reportRequired) {
        setFeedback(null);
        setRetryTurnId(null);
        markCompleted();
      } else {
        router.push("/interview");
      }
    } catch (err) {
      setActionError((err as Error).message);
      setConfirmingEnd(false);
    } finally {
      setIsEnding(false);
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
    setFeedback(null);
    setNextQuestionCandidate(null);
  }

  const endDialog = confirmingEnd && (
    <ConfirmDialog
      title="End now?"
      description={
        answeredCount > 0
          ? `We'll build your report from the ${answeredCount} ${answeredCount === 1 ? "question" : "questions"} you answered.`
          : "You haven't answered anything yet, so there's no report. End anyway?"
      }
      confirmLabel={answeredCount > 0 ? "End and see report" : "End anyway"}
      cancelLabel="Keep going"
      isConfirming={isEnding}
      onConfirm={handleEnd}
      onCancel={() => setConfirmingEnd(false)}
    />
  );

  const topBar = (withProgress: boolean) => (
    <SessionTopBar
      jobLine={jobLine}
      toneLabel={toneLabel}
      progress={withProgress ? progress : null}
      onEnd={session.status === "in_progress" ? () => setConfirmingEnd(true) : undefined}
    />
  );

  const errorBanner = actionError && (
    <p role="alert" className="rounded-lg bg-critical-soft p-3 text-sm text-ink">
      {actionError}
    </p>
  );

  // 1. Feedback on the answer just given (shown before the report, even for the last question)
  if (feedback) {
    const turn = turns.find((t) => t.id === feedback.turnId) ?? feedback.shown;
    const left = retriesOpen ? triesLeft(turn.id) : 0;
    return (
      <div className="flex flex-col gap-5">
        {topBar(true)}
        {endDialog}
        <TurnFeedback
          turn={feedback.shown}
          previous={feedback.previous}
          triesLeft={turn.is_followup ? 0 : left}
          isFollowupNext={Boolean(nextQuestionCandidate?.is_followup)}
          isDone={isCompleted || !turns.some(isPending)}
          onNext={handleProceedToNext}
          onRetry={startRetry}
          fromUploadedResume={!session.resume_id}
        />
      </div>
    );
  }

  // 2. Finished: build the report if needed, then show it
  if (isCompleted && !retryTurn) {
    if (session.report_status === "ready" && session.report) {
      return (
        <InterviewReportView
          session={session}
          report={session.report}
          turns={bestAttemptTurns(turns, attempts)}
          previousOverallScore={previousOverallScore}
          isFree={isFree}
        />
      );
    }
    return (
      <ReportBuilder
        sessionId={session.id}
        onReady={(report: InterviewReport) => setSession((prev) => ({ ...prev, report, report_status: "ready" }))}
      />
    );
  }

  if (session.status === "abandoned") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-ink">This practice was ended early</h1>
        <p className="text-sm text-ink-secondary">No questions were answered, so there&apos;s no report.</p>
        <Button href="/interview">Start a new practice</Button>
      </div>
    );
  }

  // 3. Group Coaching Explainer View (if first time in group mode)
  if (showGroupCoaching) {
    return <GroupCoachingView onStartPractice={() => setShowGroupCoaching(false)} />;
  }

  // 4. Recorded video intro: how the timing works, plus an optional unscored practice question
  if (videoStep === "intro") {
    return (
      <div className="flex flex-col gap-5">
        {topBar(false)}
        {endDialog}
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
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setVideoStep(practiceFirst ? "practice" : "live")}>
              {practiceFirst ? "Start practice question" : "Start the interview"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (videoStep === "practice" && initialMode) {
    return (
      <div className="flex flex-col gap-5">
        {topBar(false)}
        {endDialog}
        <QuestionCard
          questionText={PRACTICE_QUESTION}
          questionType="motivation"
          progressLabel="Practice question · not scored"
          stageType={session.stage_type}
        />
        <VoiceRecorder
          key="practice"
          stageType={session.stage_type}
          initialMode={initialMode}
          isLoading={false}
          submitLabel="Finish practice"
          {...consentProps}
          onAnswerSubmit={async () => {
            setVideoStep("live");
            return { ok: true };
          }}
        />
      </div>
    );
  }

  // 5. The question being answered: a retry of an answered one, or the next pending one
  const questionTurn = retryTurn ?? activeTurn;
  if (questionTurn && initialMode) {
    const isRetry = Boolean(retryTurn);
    const tryNumber = isRetry ? triesUsed(questionTurn.id) + 1 : 1;
    const focus = isRetry ? (attemptsFor(questionTurn.id).pop()?.biggest_fix ?? questionTurn.biggest_fix) : null;

    return (
      <div className="flex flex-col gap-5">
        {topBar(true)}
        {endDialog}
        {errorBanner}

        {isRetry && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-accent-soft p-3 text-sm text-ink">
            <span>
              <span className="font-semibold">
                Try {tryNumber} of {1 + MAX_RETRIES_PER_TURN}
              </span>
              {focus && <> · Focus on: {focus}</>}
            </span>
            <button
              type="button"
              onClick={() => setRetryTurnId(null)}
              className="text-xs font-semibold text-ink-secondary underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        {showFallbackBanner && !isRetry && (
          <div role="status" className="flex flex-col gap-3 rounded-lg border border-attention/30 bg-attention-soft p-4">
            <div className="flex items-start gap-2 text-sm text-ink">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-attention" />
              <p>We couldn&apos;t tailor these questions to your job, so these are general ones.</p>
            </div>
            {regenerateMsg && <p className="text-xs text-ink-secondary">{regenerateMsg}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={handleRegenerate} isLoading={isRegenerating} disabled={answeredCount > 0}>
                Try tailoring again
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFallbackDismissed(true)} disabled={isRegenerating}>
                Continue with these
              </Button>
            </div>
          </div>
        )}

        <QuestionCard
          key={`${questionTurn.id}:${tryNumber}`}
          questionText={questionTurn.question_text}
          questionType={questionTurn.question_type}
          progressLabel={progress.label}
          stageType={session.stage_type}
          isFollowup={questionTurn.is_followup}
          turnId={questionTurn.id}
        />

        {session.story_hints !== false &&
          questionTurn.suggested_evidence &&
          questionTurn.suggested_evidence.length > 0 &&
          // In a recorded video the stories are a prep aid only, never on screen while recording.
          (!isVideo || recorderPhase === "prep") && (
            <StoryHints
              key={`${questionTurn.id}:${tryNumber}`}
              hints={questionTurn.suggested_evidence}
              defaultOpen={pressureLevel !== "tough"}
              fromUploadedResume={!session.resume_id}
            />
          )}

        <StructureHelper questionType={questionTurn.question_type} />

        <VoiceRecorder
          key={`${questionTurn.id}:${tryNumber}`}
          onAnswerSubmit={isRetry ? handleRetrySubmit : handleAnswerSubmit}
          isLoading={isSubmitting}
          disabled={isRegenerating || isSkipping}
          isCoding={session.stage_type === "coding"}
          stageType={session.stage_type}
          initialMode={initialMode}
          draftKey={draftKeyFor(questionTurn.id, tryNumber)}
          {...consentProps}
          onPhaseChange={setRecorderPhase}
          submitLabel={isRetry ? "Submit this try" : "Submit answer"}
          secondaryAction={
            !isRetry && (
              <button
                type="button"
                onClick={handleSkip}
                disabled={isSkipping || isSubmitting}
                className="text-sm font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
              >
                {isSkipping ? "Skipping…" : "Skip question"}
              </button>
            )
          }
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
