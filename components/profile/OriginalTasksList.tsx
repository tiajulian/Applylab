"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const COLLAPSED_COUNT = 4;

// Splits on newlines first (a description that already has line-broken bullets, e.g. pasted
// straight from a resume), then further splits any resulting line on sentence boundaries - a
// period/!/? followed by whitespace and a capital letter. Needed because the LLM extraction in
// lib/anthropic/parseProfile.ts preserves the candidate's original wording but not necessarily
// their original line breaks, so a role's whole set of bullets often comes back as one run-on
// paragraph with no newlines at all.
function splitTasks(description: string): string[] {
  return description
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Read-only-styled view of the free-text `description` field (the candidate's original wording,
 * preserved verbatim by lib/anthropic/parseProfile.ts when a resume is imported) reframed as a
 * scannable list of individual tasks instead of one undifferentiated paragraph. There's no separate
 * "tasks" record and no local draft buffer either - every edit writes straight through
 * onDescriptionChange as it's typed, same as the win-text editor in RoleContentList.tsx, so
 * switching to edit a different line (or to "Edit all") mid-edit can never silently drop what was
 * already typed. "Edit all" drops back to the raw textarea for anything that doesn't split cleanly
 * line-by-line (a pasted paragraph, for example).
 */
export function OriginalTasksList({
  description,
  onDescriptionChange,
  findOpportunitiesAvailable,
  opportunitiesOpen,
  onToggleOpportunities,
}: {
  description: string;
  onDescriptionChange: (description: string) => void;
  /** Whether "Find achievement opportunities" (the role-duties suggestion flow) has anything to
   * offer for this role - same hasIdeas test RoleContentList already uses for its own toggle. Kept
   * visible regardless of whether there are any extracted tasks to show, so a thin, note-less role
   * can still reach it. */
  findOpportunitiesAvailable: boolean;
  opportunitiesOpen: boolean;
  onToggleOpportunities: () => void;
}) {
  const tasks = splitTasks(description);
  const [open, setOpen] = useState(tasks.length > 0);
  const [editingAll, setEditingAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function startEditingAll() {
    setEditingAll(true);
    setEditingIndex(null);
    setOpen(true);
  }

  function updateLine(index: number, text: string) {
    onDescriptionChange(tasks.map((task, i) => (i === index ? text : task)).join("\n"));
  }

  function removeLine(index: number) {
    onDescriptionChange(tasks.filter((_, i) => i !== index).join("\n"));
    if (editingIndex === index) setEditingIndex(null);
  }

  const opportunitiesCta = findOpportunitiesAvailable && (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-accent/20 bg-accent-soft p-2.5">
      <p className="text-xs text-accent">Use these tasks as inspiration, or turn them into stronger achievements with AI.</p>
      <Button type="button" variant="secondary" size="sm" onClick={onToggleOpportunities}>
        {opportunitiesOpen ? "Hide achievement opportunities" : "Find achievement opportunities"}
      </Button>
    </div>
  );

  if (tasks.length === 0 && !editingAll) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={startEditingAll}
          className="self-start rounded-sm text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Add notes about this role
        </button>
        {opportunitiesCta}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-sm text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Show original tasks ({tasks.length})
        </button>
        {opportunitiesCta}
      </div>
    );
  }

  const visibleTasks = expanded ? tasks : tasks.slice(0, COLLAPSED_COUNT);
  const hiddenCount = tasks.length - visibleTasks.length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-paper-deep/40 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink-secondary">
            Your tasks for this role
            {tasks.length > 0 && <span className="font-normal text-ink-muted"> · {tasks.length} items</span>}
          </p>
          <p className="text-xs text-ink-muted">These are the responsibilities and tasks for this role.</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            className="rounded-sm text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={startEditingAll}
          >
            Edit all
          </button>
          <button
            type="button"
            className="rounded-sm text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen(false)}
          >
            Hide
          </button>
        </div>
      </div>

      {editingAll ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label="Original tasks"
            rows={5}
            autoFocus
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
          <Button type="button" size="sm" className="self-start" onClick={() => setEditingAll(false)}>
            Done
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {visibleTasks.map((task, index) =>
              editingIndex === index ? (
                <div key={index} className="flex flex-col gap-2 rounded border border-border bg-surface p-2.5">
                  <Textarea
                    aria-label="Task"
                    rows={2}
                    autoFocus
                    value={task}
                    onChange={(e) => updateLine(index, e.target.value)}
                  />
                  <Button type="button" size="sm" className="self-start" onClick={() => setEditingIndex(null)}>
                    Done
                  </Button>
                </div>
              ) : (
                <div key={index} className="flex items-start gap-2 rounded border border-border bg-surface p-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-ink-muted" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-sm text-ink">{task}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="rounded-sm text-xs font-medium text-accent underline transition-colors duration-fast ease-editorial hover:text-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setEditingIndex(index)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label="Remove task"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => removeLine(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              className="self-start text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setExpanded(true)}
            >
              Show {hiddenCount} more
            </button>
          )}
          {expanded && tasks.length > COLLAPSED_COUNT && (
            <button
              type="button"
              className="self-start text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setExpanded(false)}
            >
              Show less
            </button>
          )}
        </>
      )}

      {opportunitiesCta}
    </div>
  );
}
