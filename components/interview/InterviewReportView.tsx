"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon, TargetIcon } from "@/components/ui/icons/LucideIcons";
import { AnnotatedTranscript } from "@/components/interview/AnnotatedTranscript";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import { PRESSURE_OPTIONS, STAGES, isPressureLevel } from "@/lib/interview/setupConstants";
import {
  SCORE_TONE_CLASSES,
  STAR_PARTS,
  STAR_PART_LABELS,
  overallToFive,
  scoreLabel,
  starAverage,
} from "@/lib/interview/scoreLabels";
import type { InterviewReport, InterviewReportQuestionSummary, InterviewSession, InterviewTurn } from "@/types";

export interface InterviewReportViewProps {
  session: InterviewSession;
  report: InterviewReport;
  /** Turns with each question's best try applied, for the expandable detail. */
  turns: InterviewTurn[];
  /** overall_score (0-100) of the last scored practice for the same job, if any. */
  previousOverallScore?: number | null;
}

function ScoreChip({ average }: { average: number }) {
  const label = scoreLabel(average);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold", SCORE_TONE_CLASSES[label.tone])}>
      {label.label} · {average.toFixed(1)}
    </span>
  );
}

function sessionMinutes(session: InterviewSession): number | null {
  if (!session.completed_at) return null;
  const ms = new Date(session.completed_at).getTime() - new Date(session.created_at).getTime();
  return ms > 0 ? Math.max(1, Math.round(ms / 60_000)) : null;
}

function QuestionRow({ summary, turn, index }: { summary: InterviewReportQuestionSummary; turn?: InterviewTurn; index: number }) {
  const [open, setOpen] = useState(false);
  const avg = summary.star_scores ? starAverage(summary.star_scores) : null;
  const tries = summary.tries ?? 1;

  return (
    <li className="rounded-lg border border-border bg-paper">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={summary.skipped}
        className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
      >
        <span className="mt-0.5 font-mono text-xs text-ink-muted">{index}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">{summary.question_text.replace(/^\[(.*?)\]\s*/, "")}</span>
          {summary.key_takeaway && !summary.skipped && (
            <span className="text-xs leading-relaxed text-ink-secondary">{summary.key_takeaway}</span>
          )}
          <span className="flex flex-wrap items-center gap-2">
            {summary.skipped ? (
              <Badge variant="neutral">Skipped</Badge>
            ) : avg !== null ? (
              <ScoreChip average={avg} />
            ) : (
              <Badge variant="neutral">Coaching</Badge>
            )}
            {!summary.skipped && tries > 1 && <span className="text-xs text-ink-muted">after {tries} tries</span>}
          </span>
        </span>
        {!summary.skipped && (
          <ChevronDownIcon className={clsx("mt-1 h-4 w-4 shrink-0 text-ink-secondary transition-transform", open && "rotate-180")} />
        )}
      </button>
      {open && turn && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {summary.first_star_scores && tries > 1 && avg !== null && (
            <p className="text-xs text-ink-secondary">
              First try {starAverage(summary.first_star_scores).toFixed(1)}, best try {avg.toFixed(1)}.
            </p>
          )}
          {turn.biggest_fix && (
            <p className="rounded bg-accent-soft p-3 text-sm text-ink">
              <span className="font-semibold">Biggest fix: </span>
              {turn.biggest_fix}
            </p>
          )}
          {turn.transcript && <AnnotatedTranscript transcript={turn.transcript} spans={turn.transcript_spans} />}
          {turn.suggested_answer && turn.suggested_answer !== turn.transcript && (
            <div className="rounded border border-accent/20 bg-accent-soft/30 p-3">
              <p className="text-xs font-semibold text-accent">A stronger version</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{turn.suggested_answer}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function InterviewReportView({ session, report, turns, previousOverallScore }: InterviewReportViewProps) {
  const router = useRouter();
  const [startingPractice, setStartingPractice] = useState<string | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  const isCoaching = report.mode === "coaching";
  const stageTitle = STAGES.find((s) => s.type === session.stage_type)?.title ?? "Interview";
  const toneLabel = PRESSURE_OPTIONS[isPressureLevel(session.pressure_level) ? session.pressure_level : "realistic"].interviewerLabel;
  const turnById = new Map(turns.map((t) => [t.id, t]));
  const summaries = report.question_summaries;

  // Main questions only, so follow-ups never change "7 of 8 answered".
  const mainTurns = turns.filter((t) => !t.is_followup);
  const total = session.question_count_target ?? mainTurns.length;
  const answered = mainTurns.filter((t) => t.transcript !== null && !t.skipped).length;
  const minutes = sessionMinutes(session);
  const overall = !isCoaching && report.overall_score !== null ? overallToFive(report.overall_score) : null;
  const previous = overall !== null && previousOverallScore != null ? overallToFive(previousOverallScore) : null;
  const change = previous !== null && overall !== null ? Math.round((overall - previous) * 10) / 10 : null;

  const fixes = summaries
    .filter((s) => !s.skipped && s.star_scores && s.biggest_fix && s.turn_id)
    .sort((a, b) => starAverage(a.star_scores!) - starAverage(b.star_scores!))
    .slice(0, 3);
  const weakestCount = Math.min(
    3,
    summaries.filter((s) => !s.skipped && s.star_scores && !turnById.get(s.turn_id ?? "")?.is_followup).length
  );

  async function startPractice(turnIds?: string[]) {
    const key = turnIds?.[0] ?? "weakest";
    setStartingPractice(key);
    setPracticeError(null);
    trackFunnelEvent("interview_practise_weakest_clicked", { single: Boolean(turnIds) });
    try {
      const res = await fetch(`/api/interview/sessions/${session.id}/practice-weakest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(turnIds ? { turnIds } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't start that practice");
      router.push(`/interview/${data.sessionId}`);
    } catch (err) {
      setPracticeError((err as Error).message);
      setStartingPractice(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Hero */}
      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-medium text-ink-muted">
          {[stageTitle, toneLabel, `${answered} of ${total} answered`, minutes ? `${minutes} min` : null].filter(Boolean).join(" · ")}
        </p>
        {overall !== null ? (
          <>
            <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-3xl font-semibold text-ink">
              {scoreLabel(overall).label}
              <span className="text-ink-secondary">{overall.toFixed(1)}</span>
            </h1>
            {change !== null && change !== 0 && (
              <p className={clsx("mt-1 text-sm font-medium", change > 0 ? "text-success" : "text-ink-secondary")}>
                {change > 0 ? "Up" : "Down"} {Math.abs(change).toFixed(1)} from your last practice for this job.
              </p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              Out of 5, from your best try at each question. Skipped questions aren&apos;t counted.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
              {session.stage_type === "coding" ? "Coding practice summary" : "Coaching summary"}
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              {session.stage_type === "coding"
                ? "Code is read, not run, so there's no score. Here's what to work on."
                : "A solo rehearsal can't score real group dynamics, so there's no number. Here's what to work on."}
            </p>
          </>
        )}
      </section>

      {/* 2. Top fixes */}
      {fixes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Your top {fixes.length === 1 ? "fix" : `${fixes.length} fixes`}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {fixes.map((f) => (
              <div key={f.turn_id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm">
                <p className="line-clamp-2 text-xs text-ink-muted">{f.question_text.replace(/^\[(.*?)\]\s*/, "")}</p>
                <p className="flex-1 text-sm text-ink">
                  <TargetIcon className="mr-1 inline h-4 w-4 align-text-bottom text-accent" />
                  {f.biggest_fix}
                </p>
                {!turnById.get(f.turn_id!)?.is_followup && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startPractice([f.turn_id!])}
                    isLoading={startingPractice === f.turn_id}
                    disabled={startingPractice !== null}
                    className="self-start rounded-pill"
                  >
                    Practise this
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Scores by part */}
      {!isCoaching && report.star_averages && (
        <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Scores by part</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {STAR_PARTS.map((p) => {
              const v = report.star_averages![p];
              return (
                <li key={p}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-ink">{STAR_PART_LABELS[p]}</span>
                    <span className="font-mono text-xs font-semibold text-ink">{v} / 5</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-pill bg-paper-deep" aria-hidden="true">
                    <div
                      className={clsx("h-full rounded-pill", v < 2.5 ? "bg-critical" : v < 3.5 ? "bg-attention" : "bg-success")}
                      style={{ width: `${(v / 5) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 4. Delivery and honest gap */}
      {(report.delivery_summary.avg_wpm > 0 || report.honest_gap_review) && (
        <section className="grid gap-4 md:grid-cols-2">
          {report.delivery_summary.avg_wpm > 0 && (
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-base font-semibold text-ink">Delivery</h2>
              <p className="mt-2 text-sm text-ink">
                Average pace <span className="font-mono font-semibold">{report.delivery_summary.avg_wpm} wpm</span>
                <span className="text-ink-muted"> (target 125 to 165)</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{report.delivery_summary.pacing_feedback}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{report.delivery_summary.filler_feedback}</p>
            </div>
          )}
          {report.honest_gap_review && (
            <div className="rounded-lg border border-attention/30 bg-attention-soft p-5">
              <h2 className="text-base font-semibold text-ink">Your honest gap answer</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink">{report.honest_gap_review}</p>
            </div>
          )}
        </section>
      )}

      {/* 5. Question by question */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">Question by question</h2>
        <ol className="flex flex-col gap-2">
          {summaries.map((s, i) => (
            <QuestionRow key={s.turn_id ?? i} summary={s} turn={s.turn_id ? turnById.get(s.turn_id) : undefined} index={i + 1} />
          ))}
        </ol>
      </section>

      {/* 6. Actions */}
      <section className="flex flex-col gap-3 border-t border-border pt-5">
        {practiceError && (
          <p role="alert" className="rounded bg-critical-soft p-3 text-sm text-ink">
            {practiceError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {weakestCount > 0 && (
            <Button
              variant="primary"
              onClick={() => startPractice()}
              isLoading={startingPractice === "weakest"}
              disabled={startingPractice !== null}
              className="rounded-pill"
            >
              {weakestCount === 3
                ? "Practise your 3 weakest questions"
                : `Practise ${weakestCount === 1 ? "this question" : `these ${weakestCount} questions`} again`}
            </Button>
          )}
          <Button href="/interview" variant="secondary" className="rounded-pill">
            New practice
          </Button>
          <a
            href={`/interview/${session.id}/report/print`}
            target="_blank"
            rel="noopener"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            Download PDF
          </a>
        </div>
      </section>
    </div>
  );
}
