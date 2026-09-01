"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CheckIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";
import type { InterviewReport, InterviewSession } from "@/types";

export interface InterviewReportViewProps {
  session: InterviewSession;
  report: InterviewReport;
}

export function InterviewReportView({ session, report }: InterviewReportViewProps) {
  const isCoaching = report.mode === "coaching";

  const formatSec = (sec: number | null) => {
    if (!sec) return "-";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Header */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Interview Complete</Badge>
              <Badge variant="neutral">
                Stage: {session.stage_type.replace("_", " ").toUpperCase()}
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-display font-semibold text-ink">
              {isCoaching ? "Group Coaching Summary" : "Interview Performance Report"}
            </h1>
            <p className="text-sm text-ink-secondary">
              {isCoaching
                ? "A solo rehearsal can't score real group dynamics. This is qualitative coaching, not a numeric rating."
                : "Grounded, calibrated evaluation of your content and spoken delivery."}
            </p>
          </div>

          {/* Overall Score Badge - simulation mode only; a coaching session never has one. */}
          {!isCoaching && report.overall_score !== null && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-paper p-4">
              <div className="text-right">
                <div className="text-xs text-ink-muted uppercase tracking-wider font-semibold">
                  Overall Score
                </div>
                <div className="text-xs text-ink-secondary">Calibrated out of 100</div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft font-display text-2xl font-bold text-accent">
                {report.overall_score}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STAR Dimensions Breakdown & Delivery Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* STAR Dimensions - simulation mode only */}
        {!isCoaching && report.star_averages && (
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-base font-semibold text-ink">Competency Averages</h2>
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-xs text-ink">
                  <span className="font-medium">Situation (Context &amp; Brevity)</span>
                  <span className="font-semibold">{report.star_averages.situation} / 5</span>
                </div>
                <ProgressBar value={(report.star_averages.situation / 5) * 100} className="mt-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-ink">
                  <span className="font-medium">Task (Clear Challenge)</span>
                  <span className="font-semibold">{report.star_averages.task} / 5</span>
                </div>
                <ProgressBar value={(report.star_averages.task / 5) * 100} className="mt-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-ink">
                  <span className="font-medium">Action (Personal Ownership &amp; Depth)</span>
                  <span className="font-semibold">{report.star_averages.action} / 5</span>
                </div>
                <ProgressBar value={(report.star_averages.action / 5) * 100} className="mt-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-ink">
                  <span className="font-medium">Result (Measurable Outcomes &amp; Learnings)</span>
                  <span className="font-semibold">{report.star_averages.result} / 5</span>
                </div>
                <ProgressBar value={(report.star_averages.result / 5) * 100} className="mt-1.5" />
              </div>
            </div>
          </div>
        )}

        {/* Delivery Performance */}
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Spoken Delivery Summary</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="rounded border border-border bg-paper p-3 text-center min-w-[100px]">
              <div className="text-xs text-ink-muted">Average Pace</div>
              <div className="font-mono text-2xl font-bold text-ink">
                {report.delivery_summary.avg_wpm} <span className="text-xs font-normal">WPM</span>
              </div>
            </div>
            <div className="flex-1">
              <Badge variant={report.delivery_summary.pacing_rating === "good" ? "success" : "attention"}>
                {report.delivery_summary.pacing_rating === "good" ? "Optimal Range (125-165 WPM)" : "Adjust Pacing"}
              </Badge>
              <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                {report.delivery_summary.pacing_feedback}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded bg-paper p-3 text-xs text-ink-secondary">
            <span className="font-semibold text-ink">Fillers &amp; Hesitation: </span>
            {report.delivery_summary.filler_feedback}
          </div>
        </div>
      </div>

      {/* Honest Gap Review (if present) */}
      {report.honest_gap_review && (
        <div className="rounded-lg border border-attention/30 bg-attention-soft/20 p-5">
          <div className="flex items-center gap-2">
            <Badge variant="attention">Honest Gap Drill Review</Badge>
          </div>
          <p className="mt-2 text-sm text-ink leading-relaxed">
            {report.honest_gap_review}
          </p>
        </div>
      )}

      {/* Strengths & Improvement Areas */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <CheckIcon className="w-4 h-4 text-success" strokeWidth={2.75} />
            <span>Demonstrated Strengths</span>
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
            {report.strengths.map((str, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-success font-bold">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
            <SparklesIcon className="w-4 h-4 text-accent" strokeWidth={2.75} />
            <span>High-Impact Areas for Improvement</span>
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-secondary">
            {report.areas_for_improvement.map((area, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent font-bold">•</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Question by Question Review */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Question Breakdown &amp; Coach Takeaways</h2>
        <div className="mt-4 space-y-4">
          {report.question_summaries.map((q, idx) => (
            <div key={idx} className="rounded border border-border bg-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <span className="text-xs font-semibold text-accent uppercase">
                  Turn {q.order_index} • {q.question_type}
                </span>
                <div className="flex items-center gap-3 text-xs text-ink-muted">
                  <span>Pace: {q.wpm || 0} WPM</span>
                  <span>Duration: {formatSec(q.duration_sec)}</span>
                  <span>Fillers: {q.filler_count ?? 0}</span>
                </div>
              </div>
              <h3 className="mt-2 text-sm font-semibold text-ink">{q.question_text}</h3>
              <p className="mt-2 text-xs text-ink-secondary leading-relaxed bg-surface p-2.5 rounded border border-border">
                <strong>Key Takeaway:</strong> {q.key_takeaway}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Link href="/interview">
          <Button variant="secondary" className="rounded-pill">Start Another Interview</Button>
        </Link>
        <Link href="/documents">
          <Button variant="primary" className="rounded-pill">Return to Documents</Button>
        </Link>
      </div>
    </div>
  );
}

