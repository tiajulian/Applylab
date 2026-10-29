"use client";

import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { scoreBand, scoreStyles } from "@/components/ui/scoreBands";

interface ScoreSummaryCardProps {
  score: number;
  totalFindings: number;
  isStale: boolean;
  unlocked: boolean;
  scoredAt?: string;
  isBasic?: boolean;
}

const BAND_BADGE = {
  good: { badgeVariant: "neutral", label: "Strong foundation" },
  okay: { badgeVariant: "attention", label: "Room to improve" },
  low: { badgeVariant: "critical", label: "Needs attention" },
} as const;

function getScoreTone(score: number) {
  const s = scoreStyles(score);
  return { color: s.text, bg: s.bg, border: s.border, ...BAND_BADGE[scoreBand(score)] };
}

export function ScoreSummaryCard({
  score,
  totalFindings,
  isStale,
  unlocked,
  scoredAt,
  isBasic = false,
}: ScoreSummaryCardProps) {
  const tone = getScoreTone(score);

  return (
    <Reveal>
      <Card className="relative overflow-hidden border border-border bg-surface p-6 shadow-sm">
        {/* Subtle background gradient glow matching score tone */}
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-2xl ${isBasic ? "bg-paper-deep" : tone.bg}`}
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div
              className={`flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-2xl border ${isBasic ? "border-border bg-paper-deep" : tone.border + " " + tone.bg} shadow-inner`}
            >
              <span className={`font-display text-3xl font-bold tracking-tight ${isBasic ? "text-ink-muted" : tone.color}`}>
                {isBasic ? <span aria-label="Not assessed">—</span> : <CountUp value={score} />}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
                {isBasic ? "Basic checks" : "/ 100"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-xl font-bold text-ink">
                  Resume quality
                </span>
                <Badge variant={isBasic ? "neutral" : tone.badgeVariant} className="text-xs">
                  {isBasic ? "Full review unavailable" : tone.label}
                </Badge>
                {isStale && (
                  <Badge variant="attention" className="text-xs">
                    Stale · Resume Edited
                  </Badge>
                )}
              </div>

              <p className="text-sm text-ink-secondary">
                {isBasic ? "Basic findings are available. The full analysis could not finish; try again later."
                  : "Content and structure guidance. Job match is assessed separately when an ad is attached."}
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
