"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
 * Repeatable "Wins (big or small)" list for a work experience role: each win pairs its text with
 * its own optional metric (proximity, not a floating metric field below). Metrics stay user-entered
 * and are never suggested or pre-filled - "no number" is an equal-weight, penalty-free choice.
 * Saved wins render as removable chips; clicking a chip expands it into an editable row in place.
 * Every keystroke writes straight back to `wins` (no separate draft buffer) so nothing typed is
 * lost if the parent form gets saved before the win's row is collapsed back to a chip.
 */
export function WinsField({
  wins,
  onChange,
}: {
  wins: WorkExperienceWin[];
  onChange: (wins: WorkExperienceWin[]) => void;
}) {
  const [tipDismissed, setTipDismissed] = useState(false);
  const [editingWin, setEditingWin] = useState<WorkExperienceWin | null>(null);

  // Drops the currently-open row from `wins` if it has no text, so switching to a different chip
  // never leaves a blank (or metric-only) pill behind. Text is the field that makes a win real -
  // generateResume.ts already only ever reads wins with non-empty text, so a metric typed without
  // text would otherwise sit in the list forever without ever reaching a resume.
  function withEditorClosed(): WorkExperienceWin[] {
    if (editingWin && !editingWin.text.trim()) {
      return wins.filter((win) => win !== editingWin);
    }
    return wins;
  }

  function removeWin(win: WorkExperienceWin) {
    onChange(wins.filter((w) => w !== win));
    if (win === editingWin) setEditingWin(null);
  }

  function startAdd() {
    const base = withEditorClosed();
    const blank: WorkExperienceWin = { text: "", metric: "" };
    onChange([...base, blank]);
    setEditingWin(blank);
  }

  function openEdit(win: WorkExperienceWin) {
    const next = withEditorClosed();
    if (next !== wins) onChange(next);
    setEditingWin(win);
  }

  function closeEditor() {
    const next = withEditorClosed();
    if (next !== wins) onChange(next);
    setEditingWin(null);
  }

  function updateEditingWin(patch: Partial<WorkExperienceWin>) {
    if (!editingWin) return;
    const updated = { ...editingWin, ...patch };
    onChange(wins.map((win) => (win === editingWin ? updated : win)));
    setEditingWin(updated);
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
        <div className="flex flex-wrap gap-2">
          {wins.map((win, index) =>
            win === editingWin ? (
              <div
                key={index}
                className="flex w-full flex-col gap-2 rounded border border-border bg-surface p-3 sm:flex-row sm:items-start"
              >
                <Textarea
                  className="sm:flex-1"
                  rows={2}
                  autoFocus
                  placeholder="e.g. sorted out the stockroom so month-end counts stopped running late"
                  value={win.text}
                  onChange={(e) => updateEditingWin({ text: e.target.value })}
                />
                <Input
                  className="sm:w-32 sm:shrink-0"
                  placeholder="number?"
                  value={win.metric}
                  onChange={(e) => updateEditingWin({ metric: e.target.value })}
                />
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" onClick={closeEditor}>
                    Done
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeWin(win)}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <span
                key={index}
                className="inline-flex max-w-full items-center gap-1.5 rounded-pill bg-accent-soft py-1.5 pl-3.5 pr-1.5 text-sm text-accent"
              >
                <button
                  type="button"
                  className="truncate text-left transition-colors duration-fast ease-editorial hover:underline"
                  onClick={() => openEdit(win)}
                >
                  {win.text}
                  {win.metric && <span className="text-accent/70"> — {win.metric}</span>}
                </button>
                <button
                  type="button"
                  aria-label="Remove win"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-accent/70 transition-colors duration-fast ease-editorial hover:bg-accent/20 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => removeWin(win)}
                >
                  ✕
                </button>
              </span>
            )
          )}
        </div>
      )}

      {!editingWin && (
        <button
          type="button"
          className="self-start text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent-hover hover:underline"
          onClick={startAdd}
        >
          + Add a win
        </button>
      )}

      <p className="text-xs text-ink-muted">Numbers optional. We never fill one in for you.</p>
    </div>
  );
}
