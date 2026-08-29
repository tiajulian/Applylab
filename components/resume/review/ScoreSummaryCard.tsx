"use client";

import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";

interface ScoreSummaryCardProps {
  score: number;
  totalFindings: number;
  isStale: boolean;
  unlocked: boolean;
  scoredAt?: string;
}

function getScoreTone(score: number): {
  color: string;
  bg: string;
  border: string;
  badgeVariant: "neutral" | "attention" | "critical";
  label: string;
} {
  if (score >= 80) {
    return {
      color: "text-success",
      bg: "bg-success-soft",
      border: "border-success/30",
      badgeVariant: "neutral",
      label: "Interview Ready",
    };
  }
  if (score >= 60) {
    return {
      color: "text-attention",
      bg: "bg-attention-soft",
      border: "border-attention/30",
      badgeVariant: "attention",
      label: "Needs Polish",
    };
  }
  return {
    color: "text-critical",
    bg: "bg-critical-soft",
    border: "border-critical/30",
    badgeVariant: "critical",
    label: "Needs Improvement",
  };
}

export function ScoreSummaryCard({
  score,
  totalFindings,
  isStale,
  unlocked,
  scoredAt,
}: ScoreSummaryCardProps) {
  const tone = getScoreTone(score);

  return (
    <Reveal>
      <Card className="relative overflow-hidden border border-border bg-surface p-6 shadow-sm">
        {/* Subtle background gradient glow matching score tone */}
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-2xl ${tone.bg}`}
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div
              className={`flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-2xl border ${tone.border} ${tone.bg} shadow-inner`}
            >
              <span className={`font-display text-3xl font-bold tracking-tight ${tone.color}`}>
                <CountUp value={score} />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                / 100
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xl font-bold text-ink">
                  Overall Diagnostic Score
                </span>
                <Badge variant={tone.badgeVariant} className="text-xs">
                  {tone.label}
                </Badge>
                {isStale && (
                  <Badge variant="attention" className="text-xs">
                    Stale · Resume Edited
                  </Badge>
                )}
              </div>

              <p className="text-sm text-ink-secondary">
                Evaluated by our <strong>AI recruiter simulation</strong> against Australian hiring benchmarks.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start border-t border-border pt-3 sm:items-end sm:border-t-0 sm:pt-0">
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>Identified Issues:</span>
              <strong className="font-semibold text-ink">{totalFindings}</strong>
            </div>
            {scoredAt && (
              <span className="mt-0.5 text-[11px] text-ink-muted">
                Last reviewed: {new Date(scoredAt).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Reveal>
  );
}
