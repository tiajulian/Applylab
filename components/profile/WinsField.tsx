"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { WinBuilder } from "@/components/profile/WinBuilder";
import type { WorkExperienceWin } from "@/types";

/** True once a win carries the step-through builder's structured slots. Legacy free-text wins
 * (entered before the Win Builder existed, or via the manual fallback) have `what` unset - both
 * kinds get the same direct text/metric edit as the primary path (see openWin below), but only a
 * structured win also gets an "Edit in builder" shortcut back to its step-through slots. */
function isStructuredWin(win: WorkExperienceWin): boolean {
  return Boolean(win.what?.trim());
}

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

interface PolishState {
  isLoading: boolean;
  suggestion: string | null;
  driftFlags: string[];
  error: string | null;
}

const IDLE_POLISH: PolishState = { isLoading: false, suggestion: null, driftFlags: [], error: null };

async function requestPolish(
  win: WorkExperienceWin,
  roleTitle: string,
  roleCompany: string
): Promise<{ suggestion: string; driftFlags: string[] } | { error: string }> {
  const response = await fetch("/api/win-polish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: win.text,
      metric: win.metric,
      verb: win.verb,
      what: win.what,
      outcome: win.outcome,
      tools: win.tools ?? [],
      stakeholders: win.stakeholders ?? [],
      roleTitle,
      roleCompany,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { error: data.error ?? "Something went wrong. Please try again." };
  return { suggestion: data.suggestion, driftFlags: data.driftFlags ?? [] };
}

/**
 * Repeatable "Wins (big or small)" list for a work experience role: each win pairs its text with
 * its own optional metric (proximity, not a floating metric field below). Metrics stay user-entered
 * and are never suggested or pre-filled - "no number" is an equal-weight, penalty-free choice.
 * New wins go through the step-through Win Builder (one small question per screen) rather than a
 * blank text box - see components/profile/WinBuilder.tsx.
 *
 * Saved wins render as removable chips. Clicking any chip - structured or legacy - opens the same
 * direct text/metric editor as the primary way to fix a win's wording; a structured win also gets
 * an "Edit in builder" link to reopen the full step-through slots (tools/stakeholders/outcome)
 * when the change is more than wording. An optional "Polish wording" pass (Haiku, grammar/flow
 * only) is offered from inside that same editor - see the build brief's never-fabricate rule: it
 * never auto-applies, always shows as an accept-or-reject suggestion, and is checked with
 * flagWinPolishDrift server-side before the suggestion ever reaches the browser.
 */
export function WinsField({
  wins,
  onChange,
  jobTitle,
  company,
  description,
  tools,
  onAddTool,
  stakeholders,
  onAddStakeholder,
}: {
  wins: WorkExperienceWin[];
  onChange: (wins: WorkExperienceWin[]) => void;
  jobTitle: string;
  company?: string;
  description: string;
  tools: string[];
  onAddTool: (tool: string) => void;
  stakeholders: string[];
  onAddStakeholder: (stakeholder: string) => void;
}) {
  const [tipDismissed, setTipDismissed] = useState(false);
  const [editingWin, setEditingWin] = useState<WorkExperienceWin | null>(null);
  const [polish, setPolish] = useState<PolishState>(IDLE_POLISH);
  // "new" for a fresh win, a WorkExperienceWin reference to re-edit an existing structured win, or
  // null when the builder is closed. Reset to "new" after every save so "Add and start another"
  // appends fresh wins instead of repeatedly overwriting the win it was first opened to edit.
  const [builderTarget, setBuilderTarget] = useState<"new" | WorkExperienceWin | null>(null);

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

  function openEdit(win: WorkExperienceWin) {
    const next = withEditorClosed();
    if (next !== wins) onChange(next);
    setEditingWin(win);
    setPolish(IDLE_POLISH);
  }

  function closeEditor() {
    const next = withEditorClosed();
    if (next !== wins) onChange(next);
    setEditingWin(null);
    setPolish(IDLE_POLISH);
  }

  function updateEditingWin(patch: Partial<WorkExperienceWin>) {
    if (!editingWin) return;
    const updated = { ...editingWin, ...patch };
    onChange(wins.map((win) => (win === editingWin ? updated : win)));
    setEditingWin(updated);
    setPolish(IDLE_POLISH);
  }

  function openInBuilder(win: WorkExperienceWin) {
    setEditingWin(null);
    setPolish(IDLE_POLISH);
    setBuilderTarget(win);
  }

  function handleBuilderSave(win: WorkExperienceWin) {
    if (builderTarget && builderTarget !== "new") {
      onChange(wins.map((w) => (w === builderTarget ? win : w)));
    } else {
      onChange([...wins, win]);
    }
    setBuilderTarget("new");
  }

  async function handlePolish() {
    if (!editingWin || !editingWin.text.trim()) return;
    setPolish({ isLoading: true, suggestion: null, driftFlags: [], error: null });
    const result = await requestPolish(editingWin, jobTitle, company ?? "");
    if ("error" in result) {
      setPolish({ isLoading: false, suggestion: null, driftFlags: [], error: result.error });
      return;
    }
    setPolish({ isLoading: false, suggestion: result.suggestion, driftFlags: result.driftFlags, error: null });
  }

  function acceptPolish() {
    if (!polish.suggestion) return;
    updateEditingWin({ text: polish.suggestion });
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
                className="flex w-full flex-col gap-2 rounded border border-border bg-surface p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
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

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={polish.isLoading || !win.text.trim()}
                    onClick={handlePolish}
                    className="text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent/70 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {polish.isLoading ? "Polishing…" : "Polish wording"}
                  </button>
                  {isStructuredWin(win) && (
                    <button
                      type="button"
                      onClick={() => openInBuilder(win)}
                      className="text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Edit in builder
                    </button>
                  )}
                </div>

                {polish.error && <p className="text-xs text-critical">{polish.error}</p>}

                {polish.suggestion && (
                  <div className="flex flex-col gap-1.5 rounded border border-accent-soft bg-accent-soft p-2.5">
                    <p className="text-xs font-medium text-ink-secondary">Suggested wording</p>
                    <p className="text-sm text-ink">
                      {polish.suggestion}
                      {win.metric && <span className="text-ink-secondary">, {win.metric}</span>}
                    </p>
                    {polish.driftFlags.length > 0 && (
                      <div className="flex flex-col gap-1 rounded bg-attention-soft p-2 text-xs text-attention">
                        {polish.driftFlags.map((flag, flagIndex) => (
                          <p key={flagIndex}>{flag}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={acceptPolish}>
                        Use this wording
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPolish(IDLE_POLISH)}
                      >
                        Keep my wording
                      </Button>
                    </div>
                  </div>
                )}
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
                  {win.metric && <span className="text-accent/70">, {win.metric}</span>}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setBuilderTarget("new")}
        >
          + Build a win
        </Button>
      )}

      <p className="text-xs text-ink-muted">Numbers optional. We never fill one in for you.</p>

      {builderTarget && (
        <WinBuilder
          jobTitle={jobTitle}
          description={description}
          profileTools={tools}
          onAddProfileTool={onAddTool}
          profileStakeholders={stakeholders}
          onAddProfileStakeholder={onAddStakeholder}
          initialWin={builderTarget === "new" ? undefined : builderTarget}
          onSave={handleBuilderSave}
          onClose={() => setBuilderTarget(null)}
        />
      )}
    </div>
  );
}
