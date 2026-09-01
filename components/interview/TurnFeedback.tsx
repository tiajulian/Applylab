"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { evaluatePacing } from "@/lib/interview/metrics";
import type { InterviewTurn } from "@/types";

export interface TurnFeedbackProps {
  turn: InterviewTurn;
  isFollowupNext?: boolean;
  isDone?: boolean;
  onNext: () => void;
}

export function TurnFeedback({
  turn,
  isFollowupNext = false,
  isDone = false,
  onNext,
}: TurnFeedbackProps) {
  const star = turn.star_scores;
  const pacing = evaluatePacing(turn.wpm || 0);

  const formatSec = (sec: number | null) => {
    if (!sec) return "-";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Coach Evaluation & Feedback</h3>
          <p className="text-xs text-ink-muted">Turn {turn.order_index} Analysis</p>
        </div>
        <Badge variant={isDone ? "success" : "accent"}>
          {isDone ? "Session Complete" : isFollowupNext ? "Adaptive Follow-up Coming" : "Next Question Ready"}
        </Badge>
      </div>

      {/* STAR Breakdown - only for scored simulation turns. A group-coaching reflection has no
          star_scores at all (see lib/gemini/scoreInterviewAnswer.ts): showing a 1-5 grid here
          would fabricate a rating for something Gemini was explicitly told not to score. */}
      {star ? (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-ink">STAR Content Scores</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-border bg-paper p-3">
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>Situation (Context)</span>
                <span className="font-semibold text-ink">{star.situation}/5</span>
              </div>
              <ProgressBar value={(star.situation / 5) * 100} className="mt-2" />
            </div>
            <div className="rounded border border-border bg-paper p-3">
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>Task (Goal / Problem)</span>
                <span className="font-semibold text-ink">{star.task}/5</span>
              </div>
              <ProgressBar value={(star.task / 5) * 100} className="mt-2" />
            </div>
            <div className="rounded border border-border bg-paper p-3">
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>Action (Your Steps)</span>
                <span className="font-semibold text-ink">{star.action}/5</span>
              </div>
              <ProgressBar value={(star.action / 5) * 100} className="mt-2" />
            </div>
            <div className="rounded border border-border bg-paper p-3">
              <div className="flex justify-between text-xs text-ink-secondary">
                <span>Result (Impact / Metric)</span>
                <span className="font-semibold text-ink">{star.result}/5</span>
              </div>
              <ProgressBar value={(star.result / 5) * 100} className="mt-2" />
            </div>
          </div>
          {star.summary && (
            <p className="mt-2 text-xs italic text-ink-muted">&ldquo;{star.summary}&rdquo;</p>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded border border-dashed border-border bg-paper p-4 text-xs text-ink-secondary">
          Group exercises are a solo rehearsal, so ApplyLab doesn&apos;t score real multi-party
          dynamics here. See the coaching notes below instead.
        </div>
      )}

      {/* Delivery Metrics */}
      <div className="mt-6 border-t border-border pt-4">
        <h4 className="text-sm font-semibold text-ink">Spoken Delivery Metrics</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-border bg-paper p-3">
            <div className="text-xs text-ink-muted">Pacing (WPM)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold text-ink">{turn.wpm || 0}</span>
              <Badge variant={pacing.rating === "good" ? "success" : "attention"}>
                {pacing.rating === "good" ? "Optimal" : pacing.rating === "too_fast" ? "Fast" : "Slow"}
              </Badge>
            </div>
          </div>
          <div className="rounded border border-border bg-paper p-3">
            <div className="text-xs text-ink-muted">Answer Duration</div>
            <div className="mt-1 font-mono text-xl font-semibold text-ink">
              {formatSec(turn.duration_sec)}
            </div>
          </div>
          <div className="rounded border border-border bg-paper p-3">
            <div className="text-xs text-ink-muted">Filler Words Approx.</div>
            <div className="mt-1 font-mono text-xl font-semibold text-ink">
              {turn.filler_count ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Content & Delivery Feedback */}
      <div className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="rounded bg-paper p-4">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-accent">
            💡 Content Feedback
          </h5>
          <p className="mt-2 text-sm text-ink leading-relaxed">
            {turn.content_feedback || "Answer noted."}
          </p>
        </div>
        <div className="rounded bg-paper p-4">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-accent">
            🎙️ Delivery Advice
          </h5>
          <p className="mt-2 text-sm text-ink leading-relaxed">
            {turn.delivery_feedback || pacing.feedback}
          </p>
        </div>
      </div>

      {/* Transcript Review */}
      {turn.transcript && (
        <div className="mt-4 rounded border border-border bg-paper-deep p-4 text-xs text-ink-secondary">
          <span className="font-semibold text-ink">Your Transcript: </span>
          &ldquo;{turn.transcript}&rdquo;
        </div>
      )}

      {/* Suggested Evidence-Grounded Answer */}
      {turn.suggested_answer && (
        <div className="mt-6 rounded-lg border border-accent/20 bg-accent-soft/30 p-4">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5" strokeWidth={2.75} />
              <span>
                {star
                  ? "Exemplary Answer (Grounded in Your Real Evidence)"
                  : "Coaching Note (Grounded in Your Real Evidence)"}
              </span>
            </h5>
            <Badge variant="neutral" className="text-[10px]">Zero Hallucinations</Badge>
          </div>
          <p className="mt-2 text-sm text-ink leading-relaxed">
            {turn.suggested_answer}
          </p>
        </div>
      )}

      {/* Next Step Action */}
      <div className="mt-6 flex justify-end">
        <Button variant="primary" onClick={onNext} className="gap-2 rounded-pill">
          {isDone
            ? "View Complete Interview Report"
            : isFollowupNext
            ? "Proceed to Follow-up Question"
            : "Continue to Next Question"}
        </Button>
      </div>
    </div>
  );
}

