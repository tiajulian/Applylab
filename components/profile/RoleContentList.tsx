"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { WinBuilder } from "@/components/profile/WinBuilder";
import { DutyImpact, RoleDutiesReview } from "@/components/profile/RoleDutiesReview";
import { checkSlotCoverage } from "@/lib/wins/dutyCoverage";
import { isWinEmpty } from "@/lib/profile/emptyEntry";
import { useSaveAction } from "@/lib/hooks/useSaveAction";
import type { UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";
import type { RoleDutyItem, WorkExperienceWin } from "@/types";

/** Encouragement, not a target - never tells the candidate what number to hit, only what the
 * current count means. */
function progressGuidance(count: number): string {
  if (count === 0) return "Start by adding one thing you accomplished in this role.";
  if (count === 1) return "Good start. Add a few more to show the breadth of your experience.";
  if (count <= 4) return "Great, you have a solid set of achievements for this role.";
  return "You have plenty to work with. We'll help you identify the strongest ones.";
}

function WinDot() {
  return <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />;
}

function HollowDot() {
  return <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-ink-muted" aria-hidden="true" />;
}

/** Same add/edit-impact affordance as DutyImpact (RoleDutiesReview.tsx), for a win row instead of
 * a duty row. No network round trip here - a win's outcome/metric live in local form state until
 * the whole profile is saved, so this only ever calls back into onSave synchronously.
 *
 * Deliberately NOT the same badge treatment as DutyImpact for the same coverage.isThin signal: a
 * win is something the candidate already framed as an achievement, so a thin one is a real gap
 * worth flagging ("Impact could be stronger", attention). A thin duty hasn't been framed as an
 * achievement at all yet - it's still just a responsibility - so DutyImpact intentionally stays
 * neutral instead of judging it. Two different states, not an inconsistency between the two. */
function WinImpact({
  win,
  onSave,
  jobTitle,
  description,
  profileTools,
  onAddProfileTool,
  profileStakeholders,
  onAddProfileStakeholder,
}: {
  win: WorkExperienceWin;
  onSave: (win: WorkExperienceWin) => void;
  jobTitle: string;
  description: string;
  profileTools: string[];
  onAddProfileTool: (tool: string) => void;
  profileStakeholders: string[];
  onAddProfileStakeholder: (stakeholder: string) => void;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const coverage = checkSlotCoverage({ outcome: win.outcome, metric: win.metric, tools: win.tools, stakeholders: win.stakeholders });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {coverage.isThin ? (
          <Badge variant="attention">⚠ Impact could be stronger</Badge>
        ) : (
          <Badge variant="success">✓ Strong achievement</Badge>
        )}
        <button
          type="button"
          className="self-start rounded-sm text-xs font-medium text-accent underline transition-colors duration-fast ease-editorial hover:text-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setBuilderOpen(true)}
        >
          {coverage.isThin ? "✨ Strengthen achievement" : "Edit impact"}
        </button>
      </div>
      {builderOpen && (
        <WinBuilder
          jobTitle={jobTitle}
          description={description}
          profileTools={profileTools}
          onAddProfileTool={onAddProfileTool}
          profileStakeholders={profileStakeholders}
          onAddProfileStakeholder={onAddProfileStakeholder}
          initialWin={win}
          onSave={(updated) => {
            onSave(updated);
            setBuilderOpen(false);
          }}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </div>
  );
}

/** A confirmed duty as a row in the unified list. "Remove" un-confirms the underlying
 * role_duty_items row (PATCHes it back to rejected, the same transition DutyCard's "Not me"
 * button makes) rather than deleting anything - same record, same write path, just reached from
 * a different place. Uses the shared save-action hook so a failed PATCH shows an error instead of
 * silently leaving the row in place with no explanation. */
function ConfirmedDutyRow({
  item,
  duties,
  jobTitle,
  description,
  tools,
  onAddTool,
  stakeholders,
  onAddStakeholder,
}: {
  item: RoleDutyItem;
  duties: UseRoleDutiesResult;
  jobTitle: string;
  description: string;
  tools: string[];
  onAddTool: (tool: string) => void;
  stakeholders: string[];
  onAddStakeholder: (stakeholder: string) => void;
}) {
  const { isSaving, error, run } = useSaveAction<RoleDutyItem>();

  async function handleRemove() {
    await run(() => duties.respond(item.id, "rejected"));
  }

  return (
    <div className="flex items-start gap-2 rounded border border-border bg-surface p-2.5">
      <HollowDot />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm text-ink">{item.user_edited_text?.trim() || item.duty_text}</p>
        <DutyImpact
          item={item}
          suggestionId={item.suggestion_id}
          jobTitle={jobTitle}
          description={description}
          profileTools={tools}
          onAddProfileTool={onAddTool}
          profileStakeholders={stakeholders}
          onAddProfileStakeholder={onAddStakeholder}
          onUpdate={duties.updateItem}
        />
        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
      <button
        type="button"
        aria-label="Remove from this role"
        disabled={isSaving}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        onClick={handleRemove}
      >
        ✕
      </button>
    </div>
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
 * The unified "What you did here" list: every win and every confirmed duty for one role, shown
 * once each, in one place. Replaces the old three-way split (description box, wins chips, and the
 * read-only "your bullets so far" preview) - this list IS the preview now, and each row still maps
 * straight back to its own record (a win row edits/removes the win in profile state, a duty row
 * PATCHes the underlying role_duty_items row), so nothing here invents a new record type or a new
 * write path. See lib/profile/useRoleDuties.ts for why duty state is a shared hook rather than
 * owned locally - the same items array backs both the confirmed rows here and the pending/rejected
 * ones inside the "Ideas from this role" disclosure below.
 */
export function RoleContentList({
  wins,
  onWinsChange,
  duties,
  jobTitle,
  company,
  location,
  description,
  tools,
  onAddTool,
  stakeholders,
  onAddStakeholder,
}: {
  wins: WorkExperienceWin[];
  onWinsChange: (wins: WorkExperienceWin[]) => void;
  duties: UseRoleDutiesResult;
  jobTitle: string;
  company: string;
  location: string;
  description: string;
  tools: string[];
  onAddTool: (tool: string) => void;
  stakeholders: string[];
  onAddStakeholder: (stakeholder: string) => void;
}) {
  const [editingWin, setEditingWin] = useState<WorkExperienceWin | null>(null);
  const [polish, setPolish] = useState<PolishState>(IDLE_POLISH);
  const [builderTarget, setBuilderTarget] = useState<"new" | WorkExperienceWin | null>(null);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [removingWin, setRemovingWin] = useState<WorkExperienceWin | null>(null);

  const confirmedDuties = duties.items.filter((item) => item.user_state === "confirmed");
  const hasIdeas = duties.status !== "hidden" && duties.status !== "dismissed";

  // Drops the currently-open row from `wins` if it's still empty, so switching away from a fresh
  // "Write a line" left untouched never leaves a blank row behind. Same emptiness test as the
  // explicit Remove button below (isWinEmpty), so a row that would prompt a confirm on Remove is
  // never instead silently dropped just by closing the editor.
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

  function openEdit(win: WorkExperienceWin) {
    const next = withEditorClosed();
    if (next !== wins) onWinsChange(next);
    setEditingWin(win);
    setPolish(IDLE_POLISH);
  }

  function closeEditor() {
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
      onWinsChange(wins.map((w) => (w === builderTarget ? win : w)));
    } else {
      onWinsChange([...wins, win]);
    }
    setBuilderTarget("new");
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

  // A blank "Write an achievement" draft (pushed into `wins` immediately so it has somewhere to
  // live while the textarea is open) shouldn't count or trigger progress copy until it actually
  // has content - otherwise "Write an achievement" and "Build with AI" (which only adds to `wins`
  // once the builder is saved) would bump the count at different points for the same intent.
  const achievementCount = wins.filter((win) => !isWinEmpty(win)).length + confirmedDuties.length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-ink-secondary">
          Achievements{achievementCount > 0 && ` · ${achievementCount}`}
        </p>
        <p className="text-xs text-ink-muted">{progressGuidance(achievementCount)}</p>
      </div>

      <div className="flex flex-col gap-2">
        {wins.map((win, index) =>
          win === editingWin ? (
            <div key={`win-${index}`} className="flex flex-col gap-2 rounded border border-border bg-surface p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <Textarea
                  className="sm:flex-1"
                  rows={2}
                  autoFocus
                  placeholder="e.g. sorted out the stockroom so month-end counts stopped running late"
                  value={win.text}
                  onChange={(e) => updateEditingWin({ text: e.target.value, what: e.target.value })}
                />
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" onClick={closeEditor}>
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
                  className="text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent/70 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {polish.isLoading ? "Polishing…" : "Polish wording"}
                </button>
                <button
                  type="button"
                  onClick={() => openInBuilder(win)}
                  className="text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPolish(IDLE_POLISH)}>
                      Keep my wording
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div key={`win-${index}`} className="flex items-start gap-2 rounded border border-border bg-surface p-2.5">
              <WinDot />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <button
                  type="button"
                  className="truncate text-left text-sm text-ink transition-colors duration-fast ease-editorial hover:underline"
                  onClick={() => openEdit(win)}
                >
                  {win.text || "(empty line, tap to add words)"}
                  {win.metric && <span className="text-ink-muted">, {win.metric}</span>}
                </button>
                <WinImpact
                  win={win}
                  onSave={(updated) => onWinsChange(wins.map((w) => (w === win ? updated : w)))}
                  jobTitle={jobTitle}
                  description={description}
                  profileTools={tools}
                  onAddProfileTool={onAddTool}
                  profileStakeholders={stakeholders}
                  onAddProfileStakeholder={onAddStakeholder}
                />
              </div>
              <button
                type="button"
                aria-label="Remove line"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => requestRemoveWin(win)}
              >
                ✕
              </button>
            </div>
          )
        )}

        {confirmedDuties.map((item) => (
          <ConfirmedDutyRow
            key={item.id}
            item={item}
            duties={duties}
            jobTitle={jobTitle}
            description={description}
            tools={tools}
            onAddTool={onAddTool}
            stakeholders={stakeholders}
            onAddStakeholder={onAddStakeholder}
          />
        ))}
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

      {!editingWin && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Add an achievement</p>
          <button
            type="button"
            onClick={() => setBuilderTarget("new")}
            className="flex flex-col gap-0.5 rounded-lg border border-accent/30 bg-surface p-3.5 text-left transition-colors duration-fast ease-editorial hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-sm font-semibold text-accent">✨ Build with AI</span>
            <span className="text-xs text-ink-secondary">
              Tell us what you did. We&apos;ll ask a few quick questions and turn it into a strong resume
              achievement.
            </span>
          </button>

          <button
            type="button"
            onClick={writeALine}
            className="self-start rounded-sm text-xs font-medium text-ink-secondary underline transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Write an achievement
          </button>
        </div>
      )}

      {hasIdeas && (
        <button
          type="button"
          className="self-start text-xs font-medium text-accent underline transition-colors duration-fast ease-editorial hover:text-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setIdeasOpen((open) => !open)}
        >
          {ideasOpen ? "Hide ideas from this role" : "Ideas from this role"}
        </button>
      )}

      {ideasOpen && hasIdeas && (
        <RoleDutiesReview
          jobTitle={jobTitle}
          company={company}
          location={location}
          duties={duties}
          onDismiss={() => setIdeasOpen(false)}
        />
      )}

      {removingWin && (
        <ConfirmDialog
          title="Remove this win?"
          description="This can't be undone."
          confirmLabel="Remove win"
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
