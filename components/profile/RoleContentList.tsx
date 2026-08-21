"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { WinBuilder } from "@/components/profile/WinBuilder";
import { SuggestTasksBuilder } from "@/components/profile/SuggestTasksBuilder";
import { checkSlotCoverage } from "@/lib/wins/dutyCoverage";
import { isWinEmpty } from "@/lib/profile/emptyEntry";
import type { UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";
import type { WorkExperienceWin } from "@/types";

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
 * The unified "What you did here" list: every win and every confirmed duty for one role, shown
 * once each, in one place. Replaces the old three-way split (description box, wins chips, and the
 * read-only "your bullets so far" preview) - this list IS the preview now, and each row still maps
 * straight back to its own record (a win row edits/removes the win in profile state, a duty row
 * PATCHes the underlying role_duty_items row), so nothing here invents a new record type or a new
 * write path. See lib/profile/useRoleDuties.ts for why duty state is a shared hook rather than
 * owned locally - the same items array backs both the confirmed rows here and the pending/rejected
 * ones inside the "Ideas from this role" disclosure below.
 */
function splitTasks(description: string): string[] {
  return description
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Unified "Experience Bullets" list: consolidates achievements and tasks into one list.
 */
export function RoleContentList({
  variant,
  wins,
  onWinsChange,
  duties,
  jobTitle,
  company,
  location,
  description,
  onDescriptionChange,
  tools,
  onAddTool,
  stakeholders,
  onAddStakeholder,
}: {
  variant: "extracted" | "manual";
  wins: WorkExperienceWin[];
  onWinsChange: (wins: WorkExperienceWin[]) => void;
  duties: UseRoleDutiesResult;
  jobTitle: string;
  company: string;
  location: string;
  description: string;
  onDescriptionChange: (description: string) => void;
  tools: string[];
  onAddTool: (tool: string) => void;
  stakeholders: string[];
  onAddStakeholder: (stakeholder: string) => void;
}) {
  const [editingWin, setEditingWin] = useState<WorkExperienceWin | null>(null);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState<string>("");
  const [polish, setPolish] = useState<PolishState>(IDLE_POLISH);
  const [builderTarget, setBuilderTarget] = useState<"new" | WorkExperienceWin | null>(null);
  const [removingWin, setRemovingWin] = useState<WorkExperienceWin | null>(null);
  const [suggestTasksOpen, setSuggestTasksOpen] = useState(false);
  const [isBatchUpgrading, setIsBatchUpgrading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const rawTasks = splitTasks(description);
  const totalCount = wins.filter((win) => !isWinEmpty(win)).length + rawTasks.length;

  function withEditorClosed(): WorkExperienceWin[] {
    if (editingWin && isWinEmpty(editingWin)) {
      return wins.filter((win) => win !== editingWin);
    }
    return wins;
  }

  function removeWin(win: WorkExperienceWin) {
    onWinsChange(wins.filter((w) => w !== win));
    if (win === editingWin) setEditingWin(null);
  }

  function requestRemoveWin(win: WorkExperienceWin) {
    if (isWinEmpty(win)) {
      removeWin(win);
    } else {
      setRemovingWin(win);
    }
  }

  function removeTask(index: number) {
    const remaining = rawTasks.filter((_, i) => i !== index);
    onDescriptionChange(remaining.join("\n"));
    if (editingTaskIndex === index) setEditingTaskIndex(null);
  }

  function updateTask(index: number, text: string) {
    const updated = rawTasks.map((t, i) => (i === index ? text : t));
    onDescriptionChange(updated.join("\n"));
    setEditingTaskIndex(null);
  }

  function openEditWin(win: WorkExperienceWin) {
    const next = withEditorClosed();
    if (next !== wins) onWinsChange(next);
    setEditingWin(win);
    setEditingTaskIndex(null);
    setPolish(IDLE_POLISH);
  }

  function closeWinEditor() {
    const next = withEditorClosed();
    if (next !== wins) onWinsChange(next);
    setEditingWin(null);
    setPolish(IDLE_POLISH);
  }

  function updateEditingWin(patch: Partial<WorkExperienceWin>) {
    if (!editingWin) return;
    const updated = { ...editingWin, ...patch };
    onWinsChange(wins.map((win) => (win === editingWin ? updated : win)));
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
      const sourceTask = builderTarget.what || builderTarget.text || "";
      if (sourceTask && rawTasks.includes(sourceTask)) {
        onDescriptionChange(rawTasks.filter((t) => t !== sourceTask).join("\n"));
        onWinsChange([...wins, win]);
      } else if (wins.includes(builderTarget)) {
        onWinsChange(wins.map((w) => (w === builderTarget ? win : w)));
      } else {
        onWinsChange([...wins, win]);
      }
    } else {
      onWinsChange([...wins, win]);
    }
    setBuilderTarget(null);
  }

  function writeALine() {
    const line: WorkExperienceWin = { text: "", metric: "", what: "" };
    onWinsChange([...wins, line]);
    setEditingWin(line);
    setPolish(IDLE_POLISH);
  }

  async function handlePolish() {
    if (!editingWin || !editingWin.text.trim()) return;
    setPolish({ isLoading: true, suggestion: null, driftFlags: [], error: null });
    const result = await requestPolish(editingWin, jobTitle, company);
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

  async function handleUpgradeAllBullets() {
    const basicWins = wins.filter((w) => !w.metric && w.text.trim());
    const itemsToUpgrade = [
      ...rawTasks,
      ...basicWins.map((w) => w.text.trim()),
    ].filter(Boolean);

    if (itemsToUpgrade.length === 0) return;

    setIsBatchUpgrading(true);
    setBatchError(null);

    try {
      const response = await fetch("/api/role-duties/generate-achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dutyTexts: itemsToUpgrade,
          jobTitle,
          company,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setBatchError(data.error ?? "Failed to upgrade bullets.");
        setIsBatchUpgrading(false);
        return;
      }

      const newWins: WorkExperienceWin[] = (data.achievements ?? []).map(
        (a: { dutyText: string; text: string }) => ({
          text: a.text,
          metric: "",
          what: a.dutyText,
        })
      );

      if (newWins.length > 0) {
        const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, " ");
        const upgradedSet = new Set(
          [
            ...itemsToUpgrade.map(normalize),
            ...newWins.map((w) => normalize(w.what || "")),
          ].filter(Boolean)
        );

        const remainingTasks = rawTasks.filter((t) => !upgradedSet.has(normalize(t)));
        onDescriptionChange(remainingTasks.join("\n"));

        // Replace basic wins that got upgraded and append new wins
        const existingStrongWins = wins.filter(
          (w) => w.metric || (!upgradedSet.has(normalize(w.text)) && !upgradedSet.has(normalize(w.what || "")))
        );
        onWinsChange([...existingStrongWins, ...newWins]);
      }
    } catch {
      setBatchError("Something went wrong while upgrading bullets.");
    } finally {
      setIsBatchUpgrading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Experience Bullets Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-ink">
          Experience Bullets ({totalCount})
        </h3>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={writeALine}>
            + Add Bullet
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSuggestTasksOpen(true)}
          >
            💡 Suggest Bullets
          </Button>
        </div>
      </div>

      {/* Unified Bullet Items List */}
      <div className="flex flex-col gap-2.5">
        {/* Render Achievements (Wins) */}
        {wins.map((win, index) => {
          const coverage = checkSlotCoverage({ outcome: win.outcome, metric: win.metric, tools: win.tools, stakeholders: win.stakeholders });
          const isBasic = coverage.isThin || !win.metric;

          if (win === editingWin) {
            return (
              <div key={`win-${index}`} className="flex flex-col gap-2 rounded border border-border bg-surface p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Textarea
                    className="sm:flex-1"
                    rows={2}
                    autoFocus
                    placeholder="e.g. Refactored 20+ SQL queries, reducing pipeline run-time by 35%"
                    value={win.text}
                    onChange={(e) => updateEditingWin({ text: e.target.value, what: e.target.value })}
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" onClick={closeWinEditor}>
                      Done
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => requestRemoveWin(win)}>
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={polish.isLoading || !win.text.trim()}
                    onClick={handlePolish}
                    className="text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {polish.isLoading ? "Polishing…" : "Polish wording"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openInBuilder(win)}
                    className="text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink"
                  >
                    Edit in builder
                  </button>
                </div>

                {polish.error && <p className="text-xs text-critical">{polish.error}</p>}

                {polish.suggestion && (
                  <div className="flex flex-col gap-1.5 rounded border border-accent-soft bg-accent-soft p-2.5">
                    <p className="text-xs font-medium text-ink-secondary">Suggested wording</p>
                    <p className="text-sm text-ink">
                      {polish.suggestion}
                      {win.metric && <span className="text-ink-secondary">, {win.metric}</span>}
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={acceptPolish}>
                        Use this wording
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setPolish(IDLE_POLISH)}>
                        Keep my wording
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={`win-${index}`} className="flex flex-col gap-1.5 rounded border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-ink min-w-0 flex-1">
                  • {win.text || "(empty bullet, tap to edit)"}
                  {win.metric && <span className="text-ink-secondary"> ({win.metric})</span>}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="rounded-sm text-xs font-medium text-ink-secondary hover:text-ink"
                    onClick={() => openEditWin(win)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-sm text-xs font-medium text-critical hover:underline"
                    onClick={() => requestRemoveWin(win)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {isBasic && (
                <button
                  type="button"
                  className="self-start rounded-sm text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                  onClick={() => openInBuilder(win)}
                >
                  ✨ Add Metrics & Impact with AI
                </button>
              )}
            </div>
          );
        })}

        {/* Render Raw Tasks from Description */}
        {rawTasks.map((task, index) =>
          editingTaskIndex === index ? (
            <div key={`task-${index}`} className="flex flex-col gap-2 rounded border border-border bg-surface p-3">
              <Textarea
                rows={2}
                autoFocus
                value={editingTaskText}
                onChange={(e) => setEditingTaskText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTaskIndex(null)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => updateTask(index, editingTaskText)}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div key={`task-${index}`} className="flex flex-col gap-1.5 rounded border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-ink min-w-0 flex-1">• {task}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="rounded-sm text-xs font-medium text-ink-secondary hover:text-ink"
                    onClick={() => {
                      setEditingTaskIndex(index);
                      setEditingTaskText(task);
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-sm text-xs font-medium text-critical hover:underline"
                    onClick={() => removeTask(index)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="self-start rounded-sm text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                onClick={() =>
                  openInBuilder({
                    text: task,
                    metric: "",
                    what: task,
                  })
                }
              >
                ✨ Add Metrics & Impact with AI
              </button>
            </div>
          )
        )}
      </div>

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

      {suggestTasksOpen && (
        <SuggestTasksBuilder
          jobTitle={jobTitle}
          company={company}
          location={location}
          duties={duties}
          existingTaskTexts={rawTasks}
          onAddTasks={(newTasks) => {
            const combined = Array.from(new Set([...rawTasks, ...newTasks]));
            onDescriptionChange(combined.join("\n"));
          }}
          onClose={() => setSuggestTasksOpen(false)}
        />
      )}

      {batchError && <p className="text-xs text-critical">{batchError}</p>}

      {/* Bottom Batch Upgrade Action */}
      <div className="mt-2 border-t border-border pt-4">
        <button
          type="button"
          disabled={totalCount === 0 || isBatchUpgrading}
          onClick={handleUpgradeAllBullets}
          className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-accent py-3.5 px-4 text-center text-on-accent shadow-sm transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBatchUpgrading ? (
            <>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent border-t-transparent" />
                ✨ Polishing your bullets...
              </span>
              <span className="text-xs font-normal opacity-90">
                Applying Australian spelling, tenses, and action verbs
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">
                ✨ Polish & Format All Bullets with AI
              </span>
              <span className="text-xs font-normal opacity-90">
                Fixes grammar, tenses, and replaces passive duties with strong action verbs
              </span>
            </>
          )}
        </button>
      </div>

      {removingWin && (
        <ConfirmDialog
          title="Remove this bullet?"
          description="This can't be undone."
          confirmLabel="Remove bullet"
          isDestructive
          onConfirm={() => {
            removeWin(removingWin);
            setRemovingWin(null);
          }}
          onCancel={() => setRemovingWin(null)}
        />
      )}
    </div>
  );
}
