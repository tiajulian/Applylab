"use client";

import { useMemo, useState } from "react";
import { clsx } from "@/lib/utils";
import { formatEnAuDate } from "@/lib/dateUtils";
import { lowestPartInsight, type ProgressPoint } from "@/lib/interview/history";
import type { StarPart } from "@/types";

type Series = "overall" | StarPart;

const SERIES: { key: Series; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
];

const W = 600;
const H = 200;
const PAD = { top: 12, right: 16, bottom: 24, left: 28 };
const MIN_POINTS = 2;

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-pill bg-paper-deep p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
          className={clsx(
            "rounded-pill px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            value === o.key ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Scores over time from first tries only (an honest measure of readiness). One series at a time,
 * so each line reads clearly without needing a legend; hover or focus a point for its value, or
 * open the table view.
 */
export function ProgressChart({
  points,
  currentResumeId,
  onPractisePart,
}: {
  points: ProgressPoint[];
  /** The job picked on the setup page, for "This job". */
  currentResumeId: string;
  onPractisePart: (part: StarPart) => void;
}) {
  const [series, setSeries] = useState<Series>("overall");
  const [scope, setScope] = useState<"all" | "job">("all");
  const [hover, setHover] = useState<number | null>(null);

  const scoped = useMemo(
    () => (scope === "job" ? points.filter((p) => p.resumeId === currentResumeId) : points),
    [points, scope, currentResumeId]
  );
  const values = scoped
    .map((p) => ({ point: p, value: series === "overall" ? p.overall : p.parts?.[series] ?? null }))
    .filter((v): v is { point: ProgressPoint; value: number } => v.value !== null);
  const insight = lowestPartInsight(points);

  if (points.length < MIN_POINTS) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const y = (v: number) => PAD.top + ((5 - v) / 4) * innerH;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v.value).toFixed(1)}`).join(" ");
  const hitWidth = innerW / Math.max(1, values.length - 1);
  const seriesLabel = SERIES.find((s) => s.key === series)!.label;
  const active = hover !== null ? values[hover] : null;

  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="progress-heading" className="font-display text-[19px] font-semibold text-ink">
          Your progress
        </h2>
        <Segmented
          label="Which practices"
          options={[
            { key: "all" as const, label: "All jobs" },
            { key: "job" as const, label: "This job" },
          ]}
          value={scope}
          onChange={setScope}
        />
      </div>
      <Segmented label="Score shown" options={SERIES} value={series} onChange={setSeries} />

      {values.length < MIN_POINTS ? (
        <p className="text-sm text-ink-secondary">
          {scope === "job"
            ? "Practise this job a couple more times to see a trend here."
            : `Not enough ${seriesLabel.toLowerCase()} scores yet to show a trend.`}
        </p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${seriesLabel} score over your last ${values.length} practices, first tries, out of 5`}>
            {[1, 2, 3, 4, 5].map((g) => (
              <g key={g}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} className="stroke-border" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(g) + 4} textAnchor="end" className="fill-ink-muted text-[11px]">
                  {g}
                </text>
              </g>
            ))}
            <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) => (
              <circle
                key={v.point.sessionId}
                cx={x(i)}
                cy={y(v.value)}
                r={hover === i ? 6 : 4}
                className="fill-accent stroke-surface"
                strokeWidth={2}
              />
            ))}
            {/* Hit targets wider than the marks, one per point */}
            {values.map((v, i) => (
              <rect
                key={`hit-${v.point.sessionId}`}
                x={x(i) - hitWidth / 2}
                y={PAD.top}
                width={hitWidth}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${formatEnAuDate(v.point.date)}: ${v.value.toFixed(1)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-pointer focus:outline-none"
              />
            ))}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-ink-muted" strokeDasharray="3 3" />
            )}
            <text x={PAD.left} y={H - 6} className="fill-ink-muted text-[11px]">
              {formatEnAuDate(values[0].point.date)}
            </text>
            <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-ink-muted text-[11px]">
              {formatEnAuDate(values[values.length - 1].point.date)}
            </text>
          </svg>
          {active && hover !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 rounded border border-border bg-surface px-2.5 py-1.5 text-xs shadow-pop"
              style={{ left: `${(x(hover) / W) * 100}%`, top: 0 }}
            >
              <div className="text-ink-muted">{formatEnAuDate(active.point.date)}</div>
              <div className="font-semibold text-ink">
                {seriesLabel} {active.value.toFixed(1)}
              </div>
            </div>
          )}
        </div>
      )}

      {insight && (
        <p className="text-sm text-ink">
          {insight.label} is your lowest score in {insight.count} of your last {insight.of} sessions.{" "}
          <button
            type="button"
            onClick={() => onPractisePart(insight.part)}
            className="font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Practise {insight.label.toLowerCase()}-heavy questions
          </button>
        </p>
      )}

      {values.length >= MIN_POINTS && (
        <details className="text-xs text-ink-secondary">
          <summary className="cursor-pointer font-medium">Show as a table</summary>
          <table className="mt-2 w-full text-left">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 font-medium">{seriesLabel} (first try, out of 5)</th>
              </tr>
            </thead>
            <tbody>
              {values.map((v) => (
                <tr key={v.point.sessionId} className="border-t border-border">
                  <td className="py-1">{formatEnAuDate(v.point.date, { includeYear: true })}</td>
                  <td className="py-1 font-mono">{v.value.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
