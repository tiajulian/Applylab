"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import type { WorkExperienceWin } from "@/types";

// Single config value so swapping the tip's copy is a one-line change. Must never contain a
// fabricated or invented statistic - directional truth only (see build brief).
const WINS_TIP =
  "This is the part recruiters remember. It does not need to be big, one real, specific win beats a whole list of duties.";

function TipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-0.5 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M8 1a4.5 4.5 0 0 0-2.5 8.24c.3.2.5.55.5.94V11h4v-.82c0-.39.2-.74.5-.94A4.5 4.5 0 0 0 8 1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M6.25 13.5h3.5M6.75 15h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Repeatable "Wins (big or small)" list for a work experience role: each row pairs a win with its
 * own optional metric (proximity, not a floating metric field below). Metrics stay user-entered
 * and are never suggested or pre-filled - "no number" is an equal-weight, penalty-free choice.
 */
export function WinsField({
  wins,
  onChange,
}: {
  wins: WorkExperienceWin[];
  onChange: (wins: WorkExperienceWin[]) => void;
}) {
  const [tipDismissed, setTipDismissed] = useState(false);

  function updateWin(index: number, patch: Partial<WorkExperienceWin>) {
    onChange(wins.map((win, i) => (i === index ? { ...win, ...patch } : win)));
  }

  function removeWin(index: number) {
    onChange(wins.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-ink-secondary">Wins (big or small)</label>
        <Badge variant="accent">Recommended</Badge>
      </div>
      <p className="text-xs text-ink-secondary">
        Anything you built, improved, fixed, or made easier. It counts even if it felt routine.
      </p>

      {!tipDismissed && (
        <div className="flex items-start justify-between gap-3 rounded border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent">
          <div className="flex items-start gap-2">
            <TipIcon />
            <span>{WINS_TIP}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss tip"
            className="shrink-0 text-xs text-accent/70 transition-colors duration-fast ease-editorial hover:text-accent"
            onClick={() => setTipDismissed(true)}
          >
            ✕
          </button>
        </div>
      )}

      {wins.length > 0 && (
        <div className="flex flex-col gap-2">
          {wins.map((win, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Textarea
                className="sm:flex-1"
                rows={2}
                placeholder="e.g. sorted out the stockroom so month-end counts stopped running late"
                value={win.text}
                onChange={(e) => updateWin(index, { text: e.target.value })}
              />
              <div className="flex items-center gap-2 sm:shrink-0">
                <Input
                  className="sm:w-32"
                  placeholder="number?"
                  value={win.metric}
                  onChange={(e) => updateWin(index, { metric: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Remove win"
                  className="shrink-0 rounded-sm text-xs text-critical transition-colors duration-fast ease-editorial hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => removeWin(index)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="self-start text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent-hover hover:underline"
        onClick={() => onChange([...wins, { text: "", metric: "" }])}
      >
        + Add a win
      </button>

      <p className="text-xs text-ink-muted">Numbers optional. We never fill one in for you.</p>
    </div>
  );
}
