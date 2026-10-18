"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SparklesIcon, LightbulbIcon, TargetIcon, MicIcon, ChevronDownIcon } from "@/components/ui/icons/LucideIcons";
import { AnnotatedTranscript } from "@/components/interview/AnnotatedTranscript";
import { evaluatePacing, OPTIMAL_WPM_MAX, OPTIMAL_WPM_MIN } from "@/lib/interview/metrics";
import { topFillers } from "@/lib/interview/spans";
import { SCORE_TONE_CLASSES, scoreLabel } from "@/lib/interview/scoreLabels";
import { hasWeakScoredPart, turnScores, type TurnScores } from "@/lib/interview/rubrics";
import { clsx } from "@/lib/utils";
import type { InterviewTurn, TechnicalAssessment } from "@/types";

export interface TurnFeedbackProps {
  /** The answer being shown (a retry is shown merged over its turn). */
  turn: InterviewTurn;
  /** The try before this one, for "Result 2 → 4"; null on a first try. */
  previous?: InterviewTurn | null;
  /** Tries still available on this question (0 hides "Try again"). */
  triesLeft?: number;
  isFollowupNext?: boolean;
  isDone?: boolean;
  onNext: () => void;
  onRetry?: () => void;
  /** "Upload my resume" practice: evidence comes from that resume, not the Career Profile. */
  fromUploadedResume?: boolean;
}

const formatSec = (sec: number | null) => {
  if (!sec) return "-";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s} sec`;
  return `${m} min ${s < 10 ? "0" : ""}${s} sec`;
};

/** Highlights placeholders such as [your real result] so they read as blanks to fill. */
function WithPlaceholders({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[your real [^\]]+\])/g).map((part, i) =>
        /^\[your real [^\]]+\]$/.test(part) ? (
          <mark key={i} className="rounded bg-attention-soft px-1 font-medium text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

const PACE_MIN = 60;
const PACE_MAX = 220;
const pacePct = (wpm: number) => ((Math.min(PACE_MAX, Math.max(PACE_MIN, wpm)) - PACE_MIN) / (PACE_MAX - PACE_MIN)) * 100;

function paceMeaning(wpm: number): string {
  const { rating } = evaluatePacing(wpm);
  if (rating === "too_fast") return "A bit fast. Slow down at the result so it lands.";
  if (rating === "too_slow") return "A bit slow. Pick up the pace a little so it flows.";
  return "A good pace. Easy to follow.";
}

function durationMeaning(sec: number | null): string {
  if (!sec) return "";
  if (sec < 60) return "Under the 1 to 2 minute guide. There may be room for more detail.";
  if (sec > 120) return "Over the 1 to 2 minute guide. Try trimming the set-up.";
  return "Within the 1 to 2 minute guide.";
}

function Delivery({ turn }: { turn: InterviewTurn }) {
  const wpm = turn.wpm || 0;
  const fillers = topFillers(turn.transcript || "");
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h4 className="text-sm font-semibold text-ink">Delivery</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-border bg-paper p-3 sm:col-span-2">
          <div className="flex items-baseline justify-between text-xs text-ink-muted">
            <span>Pace</span>
            <span className="font-mono text-base font-semibold text-ink">{wpm || "-"} wpm</span>
          </div>
          {wpm > 0 && (
            <>
              <div className="relative mt-2 h-2 rounded-pill bg-paper-deep" aria-hidden="true">
                <div
                  className="absolute inset-y-0 rounded-pill bg-success-soft"
                  style={{ left: `${pacePct(OPTIMAL_WPM_MIN)}%`, right: `${100 - pacePct(OPTIMAL_WPM_MAX)}%` }}
                />
                <div className="absolute -top-1 h-4 w-1 rounded bg-ink" style={{ left: `calc(${pacePct(wpm)}% - 2px)` }} />
              </div>
              <p className="mt-2 text-xs text-ink-secondary">
                {paceMeaning(wpm)} Target: {OPTIMAL_WPM_MIN} to {OPTIMAL_WPM_MAX} wpm.
              </p>
            </>
          )}
        </div>
        <div className="rounded border border-border bg-paper p-3">
          <div className="text-xs text-ink-muted">Filler words</div>
          <div className="mt-1 font-mono text-base font-semibold text-ink">{turn.filler_count ?? 0}</div>
          {fillers.length > 0 && (
            <p className="mt-1 text-xs text-ink-secondary">
              Most used: {fillers.map((f) => `"${f.word}" (${f.count})`).join(", ")}
            </p>
          )}
        </div>
      </div>
      {turn.duration_sec ? (
        <p className="text-xs text-ink-secondary">
          You spoke for {formatSec(turn.duration_sec)}. {durationMeaning(turn.duration_sec)}
        </p>
      ) : null}
    </section>
  );
}

function ScoredFeedback({
  turn,
  scores,
  previous,
  fromUploadedResume = false,
}: {
  turn: InterviewTurn;
  scores: TurnScores;
  previous?: InterviewTurn | null;
  fromUploadedResume?: boolean;
}) {
  const [showStronger, setShowStronger] = useState(false);
  const avg = scores.average;
  const label = scoreLabel(avg);
  const prevById = new Map((previous ? turnScores(previous)?.parts ?? [] : []).map((p) => [p.key, p.score]));
  const deltas = scores.parts.filter((p) => prevById.has(p.key) && prevById.get(p.key) !== p.score);

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Result */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-muted">
            {turn.is_followup ? "Follow-up" : scores.definition.kind} · marked on {scores.definition.markedOn}
          </p>
          <p className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold text-ink">
            <span className={clsx("rounded-pill px-3 py-0.5 text-base font-semibold", SCORE_TONE_CLASSES[label.tone])}>
              {label.label}
            </span>
            {avg.toFixed(1)}
          </p>
        </div>
        {deltas.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Change since your last try">
            {deltas.map((p) => (
              <li
                key={p.key}
                className={clsx("rounded-pill px-2 py-0.5", p.score > prevById.get(p.key)! ? "bg-success-soft text-ink" : "bg-critical-soft text-ink")}
              >
                {p.label} {prevById.get(p.key)} → {p.score}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* 2. Biggest fix */}
      {turn.biggest_fix && (
        <div className="rounded-lg bg-accent-soft p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-accent">
            <TargetIcon className="h-4 w-4" /> Your biggest fix
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{turn.biggest_fix}</p>
        </div>
      )}

      {turn.what_worked && turn.what_worked.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-ink-secondary">What worked</p>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {turn.what_worked.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-success">✓</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Score breakdown */}
      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h4 className="text-sm font-semibold text-ink">Score breakdown</h4>
        <ul className="flex flex-col gap-3">
          {scores.parts.map((p) => (
            <li key={p.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-ink">{p.label}</span>
                <span className="font-mono text-xs font-semibold text-ink">{p.score} / 5</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-pill bg-paper-deep" aria-hidden="true">
                <div
                  className={clsx("h-full rounded-pill", p.score <= 2 ? "bg-critical" : p.score === 3 ? "bg-attention" : "bg-success")}
                  style={{ width: `${(p.score / 5) * 100}%` }}
                />
              </div>
              {p.reason && <p className="mt-1 text-xs text-ink-secondary">{p.reason}</p>}
            </li>
          ))}
        </ul>
        {!turn.score_reasons && turn.star_scores?.summary && <p className="text-xs italic text-ink-muted">{turn.star_scores.summary}</p>}
      </section>

      {/* 4. Your answer, annotated */}
      {turn.transcript && (
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-ink">Your answer</h4>
          <AnnotatedTranscript transcript={turn.transcript} spans={turn.transcript_spans} />
        </section>
      )}

      {/* 5. Delivery (spoken answers only) */}
      {turn.answer_source === "voice" && <Delivery turn={turn} />}

      {/* 6. A stronger version */}
      {turn.suggested_answer && turn.suggested_answer !== turn.transcript && (
        <section className="border-t border-border pt-5">
          <button
            type="button"
            aria-expanded={showStronger}
            onClick={() => setShowStronger((v) => !v)}
            className="flex items-center gap-1.5 rounded text-sm font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <SparklesIcon className="h-4 w-4" />
            {showStronger ? "Hide the stronger version" : "See a stronger version"}
            <ChevronDownIcon className={clsx("h-4 w-4 transition-transform duration-fast", showStronger && "rotate-180")} />
          </button>
          {showStronger && (
            <div className="mt-3 rounded-lg border border-accent/20 bg-accent-soft/30 p-4">
              <p className="text-sm leading-relaxed text-ink">
                <WithPlaceholders text={turn.suggested_answer} />
              </p>
              {turn.suggested_answer_sources && turn.suggested_answer_sources.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-ink-muted">Built from:</span>
                  {turn.suggested_answer_sources.map((src) =>
                    fromUploadedResume ? (
                      <span key={src.id} className="rounded-pill border border-border bg-surface px-2 py-0.5 text-ink-secondary">
                        {src.label}
                      </span>
                    ) : (
                      <Link
                        key={src.id}
                        href="/profile"
                        className="rounded-pill border border-border bg-surface px-2 py-0.5 text-ink-secondary hover:text-ink"
                      >
                        {src.label}
                      </Link>
                    )
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-ink-muted">
                Only uses your {fromUploadedResume ? "resume" : "profile"} and what you said. Fill any highlighted blank with your real
                detail.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CoachingFeedback({ turn }: { turn: InterviewTurn }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded border border-dashed border-border bg-paper p-4 text-xs text-ink-secondary">
        Group exercises are a solo rehearsal, so ApplyLab doesn&apos;t score real multi-party dynamics here. See the
        coaching notes below instead.
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded bg-paper p-4">
          <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <LightbulbIcon className="h-4 w-4" /> Coaching note
          </h5>
          <p className="mt-2 text-sm leading-relaxed text-ink">{turn.content_feedback || "Answer noted."}</p>
        </div>
        <div className="rounded bg-paper p-4">
          <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <MicIcon className="h-4 w-4" /> Delivery
          </h5>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {turn.delivery_feedback || evaluatePacing(turn.wpm || 0).feedback}
          </p>
        </div>
      </div>
      {turn.transcript && (
        <div className="rounded border border-border bg-paper-deep p-4 text-sm text-ink-secondary">
          <span className="font-semibold text-ink">Your answer: </span>
          {turn.transcript}
        </div>
      )}
      {turn.suggested_answer && (
        <div className="rounded-lg border border-accent/20 bg-accent-soft/30 p-4">
          <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <SparklesIcon className="h-3.5 w-3.5" /> Another way to say it
          </h5>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            <WithPlaceholders text={turn.suggested_answer} />
          </p>
        </div>
      )}
    </div>
  );
}

function CodingFeedback({ turn, tech }: { turn: InterviewTurn; tech: TechnicalAssessment | null }) {
  return (
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
          <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <LightbulbIcon className="h-4 w-4" /> What You Did Well
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
          <h5 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <TargetIcon className="h-4 w-4" /> What to Improve
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
              <SparklesIcon className="w-3.5 h-3.5" strokeWidth={2} />
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
            <span>Coach note (from your real experience)</span>
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
  );
}

export function TurnFeedback({
  turn,
  previous = null,
  triesLeft = 0,
  isFollowupNext = false,
  isDone = false,
  onNext,
  onRetry,
  fromUploadedResume = false,
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

  const scores = isCodingTurn ? null : turnScores(turn);
  const canRetry = Boolean(scores && onRetry && triesLeft > 0);
  const retryFirst = canRetry && hasWeakScoredPart(scores);
  const nextLabel = isDone ? "See my report" : isFollowupNext ? "Next: a follow-up question" : "Next question";

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
      {isCodingTurn ? (
        <CodingFeedback turn={turn} tech={tech} />
      ) : scores ? (
        <ScoredFeedback turn={turn} scores={scores} previous={previous} fromUploadedResume={fromUploadedResume} />
      ) : (
        <CoachingFeedback turn={turn} />
      )}

      {/* Actions: sticky on phones so the next step is always in reach */}
      <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur-[10px] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        {canRetry && (
          <>
            <span className="mr-auto text-xs text-ink-muted">
              {triesLeft} {triesLeft === 1 ? "try" : "tries"} left
            </span>
            <Button variant={retryFirst ? "primary" : "secondary"} onClick={onRetry} className="rounded-pill">
              Try again
            </Button>
          </>
        )}
        <Button variant={retryFirst ? "secondary" : "primary"} onClick={onNext} className="rounded-pill">
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
