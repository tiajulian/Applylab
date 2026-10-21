"use client";

import { Card } from "@/components/ui/Card";
import { CountUp } from "@/components/ui/CountUp";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Reveal } from "@/components/ui/Reveal";
import { scoreBand, scoreStyles } from "@/components/ui/scoreBands";
import { REVIEW_CATEGORIES } from "./reviewCategories";
import type { ResumeReviewCategory } from "@/types";

interface ReviewSummaryProps {
  score: number;
  categories: ResumeReviewCategory[];
  /** Findings not yet applied. */
  openCount: number;
  scoredAt?: string;
}

const VERDICT = {
  good: "Interview ready",
  okay: "Almost there",
  low: "Needs work",
} as const;

function verdictDetail(band: keyof typeof VERDICT, openCount: number) {
  if (openCount === 0) {
    return band === "good" ? "Nothing left to fix." : "Strengthen the lower-scoring areas below, then check again.";
  }
  const things = `${openCount} ${openCount === 1 ? "suggestion" : "suggestions"}`;
  if (band === "good") return `Strong resume. ${things} could make it even better.`;
  if (band === "okay") return `${things} below will get it interview ready.`;
  return `${things} below. Work through them from the top.`;
}

/** The score, a one-line verdict, and how the 100 points split across the five areas. */
export function ReviewSummary({ score, categories, openCount, scoredAt }: ReviewSummaryProps) {
  const band = scoreBand(score);
  const tone = scoreStyles(score);

  return (
    <Reveal>
      <Card className="border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-2xl border ${tone.border} ${tone.bg}`}
          >
            <span className={`font-display text-2xl font-bold leading-none ${tone.text}`}>
              <CountUp value={score} />
            </span>
            <span className="mt-0.5 text-[10px] text-ink-muted">/ 100</span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-xl font-bold text-ink">{VERDICT[band]}</h2>
            <p className="text-sm text-ink-secondary">{verdictDetail(band, openCount)}</p>
            {scoredAt && (
              <p className="text-xs text-ink-muted">
                Checked{" "}
                {new Date(scoredAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "Australia/Sydney",
                })}
              </p>
            )}
          </div>
        </div>

        <ul className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
          {categories.map((category) => {
            const pct = category.max_points > 0 ? Math.min(100, Math.round((category.score / category.max_points) * 100)) : 0;
            const display = REVIEW_CATEGORIES[category.key];
            return (
              <li
                key={category.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_8rem_3.5rem]"
              >
                <span className="col-start-1 row-start-1 truncate text-sm text-ink" title={display.description}>
                  {display.label}
                </span>
                <ProgressBar
                  value={pct}
                  className="col-span-2 row-start-2 h-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                  barClassName={scoreStyles(pct).bar}
                />
                <span className="col-start-2 row-start-1 text-right text-sm tabular-nums text-ink sm:col-start-3">
                  {category.score}
                  <span className="text-ink-muted">/{category.max_points}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </Reveal>
  );
}
