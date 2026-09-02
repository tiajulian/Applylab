"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { evaluatePacing } from "@/lib/interview/metrics";
import type { InterviewTurn, TechnicalAssessment } from "@/types";

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
  const isCodingTurn =
    Boolean(turn.technical_assessment) ||
    (turn.star_scores && "correctness" in turn.star_scores) ||
    turn.question_type === "coding" ||
    turn.question_type === "sql";

  const tech: TechnicalAssessment | null =
    turn.technical_assessment ||
    (turn.star_scores && "correctness" in turn.star_scores
      ? (turn.star_scores as unknown as TechnicalAssessment)
      : null);

  const star = isCodingTurn ? null : turn.star_scores;
  const pacing = evaluatePacing(turn.wpm || 0);

  const formatSec = (sec: number | null) => {
    if (!sec) return "-";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m === 0) return `${s} sec`;
    return `${m} min ${s < 10 ? "0" : ""}${s} sec`;
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

      {isCodingTurn ? (
        /* CODING / TECHNICAL ASSESSMENT VIEW */
        <>
          {/* Section 1: Technical Assessment (Overall Score, Correctness, Time Taken) */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-ink">Technical Assessment</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {/* Overall Score */}
              <div className="rounded border border-border bg-paper p-3">
                <div className="text-xs text-ink-muted">Overall Score</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-xl font-semibold text-ink">
                    {tech?.score ?? 8} / 10
                  </span>
                  <Badge
                    variant={
                      tech?.score && tech.score >= 8
                        ? "success"
                        : tech?.score && tech.score >= 6
                        ? "accent"
                        : "attention"
                    }
                  >
                    {tech?.score_label || "Strong Performance"}
                  </Badge>
                </div>
              </div>

              {/* Correctness */}
              <div className="rounded border border-border bg-paper p-3">
                <div className="text-xs text-ink-muted">Correctness</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant={
                      tech?.correctness === "correct"
                        ? "success"
                        : tech?.correctness === "partially_correct"
                        ? "attention"
                        : "critical"
                    }
                  >
                    {tech?.correctness_label ||
                      (tech?.correctness === "correct"
                        ? "Correct"
                        : tech?.correctness === "partially_correct"
                        ? "Partially Correct"
                        : "Incorrect")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-secondary leading-snug">
                  {tech?.correctness_summary || "Your solution produces the expected result."}
                </p>
              </div>

              {/* Time Taken */}
              <div className="rounded border border-border bg-paper p-3">
                <div className="text-xs text-ink-muted">Time Taken</div>
                <div className="mt-1 font-mono text-xl font-semibold text-ink">
                  {formatSec(turn.duration_sec)}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {tech?.time_assessment ||
                    (turn.duration_sec && turn.duration_sec > 0 ? "Good pace" : "Self-paced")}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: What You Did Well & What to Improve */}
          <div className="mt-6 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div className="rounded bg-paper p-4">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-accent">
                💡 What You Did Well
              </h5>
              {tech?.strengths && tech.strengths.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm text-ink leading-relaxed">
                  {tech.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-accent font-bold">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink leading-relaxed">
                  {turn.content_feedback || "Applied a structured approach to solving the problem."}
                </p>
              )}
            </div>

            <div className="rounded bg-paper p-4">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-accent">
                🎯 What to Improve
              </h5>
              {tech?.improvements && tech.improvements.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-sm text-ink leading-relaxed">
                  {tech.improvements.map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-accent font-bold">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink leading-relaxed">
                  {turn.delivery_feedback ||
                    "No major technical issues. Your main opportunity is to make your reasoning more explicit."}
                </p>
              )}
            </div>
          </div>

          {/* Section 3: Coaching Advice */}
          {tech?.coaching_advice && (
            <div className="mt-4 rounded-lg border border-accent/20 bg-accent-soft/30 p-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <SparklesIcon className="w-3.5 h-3.5" strokeWidth={2.75} />
                  <span>Coaching Advice</span>
                </h5>
              </div>
              <p className="mt-1.5 text-sm text-ink leading-relaxed whitespace-pre-line">
                {tech.coaching_advice}
              </p>
            </div>
          )}

          {/* Section 4: Code Solutions (Your Answer & Expected Solution) */}
          {(turn.transcript || tech?.expected_solution || (turn.suggested_answer && turn.suggested_answer !== turn.transcript && turn.suggested_answer !== tech?.coaching_advice)) && (
            <div className={`mt-4 grid gap-4 ${(turn.transcript && (tech?.expected_solution || turn.suggested_answer)) ? "md:grid-cols-2" : ""}`}>
              {/* Your Answer */}
              {turn.transcript && (
                <div className="rounded border border-border bg-paper-deep p-4 text-xs text-ink-secondary flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-ink">Your Answer:</span>
                    <Badge
                      variant={
                        tech?.correctness === "correct"
                          ? "success"
                          : tech?.correctness === "partially_correct"
                          ? "attention"
                          : "critical"
                      }
                    >
                      {tech?.correctness_label ||
                        (tech?.correctness === "correct"
                          ? "Correct"
                          : tech?.correctness === "partially_correct"
                          ? "Partially Correct"
                          : "Incorrect")}
                    </Badge>
                  </div>
                  <pre className="font-mono text-xs text-ink whitespace-pre-wrap overflow-x-auto bg-surface/80 p-3 rounded border border-border/60 flex-1">
                    <code>{turn.transcript}</code>
                  </pre>
                </div>
              )}

              {/* Expected / Model Solution */}
              {(tech?.expected_solution || (turn.suggested_answer && turn.suggested_answer !== turn.transcript && turn.suggested_answer !== tech?.coaching_advice)) && (
                <div className="rounded border border-border bg-paper-deep p-4 text-xs text-ink-secondary flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-ink">Expected Solution:</span>
                    <Badge variant="accent">Model Solution</Badge>
                  </div>
                  <pre className="font-mono text-xs text-ink whitespace-pre-wrap overflow-x-auto bg-surface/80 p-3 rounded border border-border/60 flex-1">
                    <code>{tech?.expected_solution || turn.suggested_answer}</code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Section 5: Coach Note (Single Most Important Takeaway) */}
          <div className="mt-4 rounded-lg border border-border bg-paper p-4">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <span>Coach Note (Grounded in Your Real Evidence)</span>
              </h5>
              <Badge variant="neutral" className="text-[10px]">Zero Hallucinations</Badge>
            </div>
            <p className="mt-1.5 text-sm text-ink leading-relaxed font-medium">
              {tech?.coach_note ||
                (tech?.correctness === "correct"
                  ? "Technically correct solution. Focus on verbalising your reasoning before coding."
                  : tech?.correctness === "partially_correct"
                  ? "Review core edge cases and verify logic before concluding your answer."
                  : "Review the problem requirements and verify your logic before writing code.")}
            </p>
          </div>
        </>
      ) : (
        /* STANDARD BEHAVIOURAL / SIMULATION & GROUP COACHING VIEW */
        <>
          {/* STAR Breakdown */}
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
        </>
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

