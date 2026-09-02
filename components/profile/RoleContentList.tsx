"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { WinBuilder } from "@/components/profile/WinBuilder";
import { SuggestTasksBuilder } from "@/components/profile/SuggestTasksBuilder";
import { SignupAtGenerateModal } from "@/components/auth/SignupAtGenerateModal";
import { createClient } from "@/lib/supabase/client";
import { checkSlotCoverage } from "@/lib/wins/dutyCoverage";
import { isWinEmpty } from "@/lib/profile/emptyEntry";
import { stripBulletPrefix } from "@/lib/text/cleanBullet";
import type { UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";
import type { WorkExperienceWin } from "@/types";

interface PolishState {
  isLoading: boolean;
  suggestion: string | null;
  driftFlags: string[];
  error: string | null;
}

const IDLE_POLISH: PolishState = { isLoading: false, suggestion: null, driftFlags: [], error: null };

/**
 * One AI suggestion from "Polish & Format All Bullets", awaiting a per-bullet decision - nothing
 * touches `wins`/description until the candidate accepts it. `originalWin` is the exact pre-upgrade
 * win object (not just its text), so accepting preserves any fields beyond text (tools,
 * stakeholders, ...); `originalTaskText` is set instead when the source was a raw description line
 * rather than an existing win.
 */
interface BulletProposal {
  key: string;
  originalText: string;
  suggestedText: string;
  originalTaskText?: string;
  originalWin?: WorkExperienceWin;
}

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
    .map((line) => stripBulletPrefix(line))
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
  onAddSkills,
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
  onAddSkills: (skills: string[]) => void;
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
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [pendingProposals, setPendingProposals] = useState<BulletProposal[] | null>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [candidateFullName, setCandidateFullName] = useState("");
  const [pendingAction, setPendingAction] = useState<"upgrade" | "suggest" | null>(null);

  /** Anonymous onboarding users can browse and edit freely, but both AI actions below require a
   * permanent account server-side (requirePermanentUser) - checking here first avoids a pointless
   * round trip to eat a 401, and lets onSuccess below resume the exact action that was blocked. */
  async function requireSignup(action: "upgrade" | "suggest"): Promise<boolean> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.is_anonymous) {
      setCandidateFullName(user.user_metadata?.full_name ?? "");
      setPendingAction(action);
      setShowSignupModal(true);
      return true;
    }
    return false;
  }

  const rawTasks = splitTasks(description);
  const totalCount = wins.filter((win) => !isWinEmpty(win)).length + rawTasks.length;
  // Drops any proposal whose source line/win no longer exists - the review panel stays open while
  // the candidate keeps editing elsewhere, so a task deleted (or a win hand-edited, which swaps in
  // a new object) after its suggestion was generated must disappear from review too. Without this,
  // accepting a stale proposal either resurrects a bullet the candidate just deleted, or silently
  // no-ops against a win reference that no longer matches anything in `wins`.
  //
  // Task lines are plain strings with no identity, so two proposals can share the same
  // originalTaskText (genuine duplicate lines) - a plain `rawTasks.includes(text)` check would keep
  // both visible even after the candidate deletes only one of the two matching lines. Counting
  // occurrences instead means only as many same-text proposals stay visible as lines actually
  // remain.
  const rawTaskCounts = new Map<string, number>();
  for (const t of rawTasks) rawTaskCounts.set(t, (rawTaskCounts.get(t) ?? 0) + 1);
  const claimedTaskCounts = new Map<string, number>();
  const visibleProposals =
    pendingProposals?.filter((p) => {
      if (p.originalWin) return wins.includes(p.originalWin);
      if (!p.originalTaskText) return true;
      const claimed = claimedTaskCounts.get(p.originalTaskText) ?? 0;
      claimedTaskCounts.set(p.originalTaskText, claimed + 1);
      return claimed < (rawTaskCounts.get(p.originalTaskText) ?? 0);
    }) ?? null;

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
    if (await requireSignup("upgrade")) return;
    await runUpgradeAllBullets();
  }

  async function runUpgradeAllBullets() {
    const basicWins = wins.filter((w) => !w.metric && w.text.trim());
    const itemsToUpgrade = [
      ...rawTasks,
      ...basicWins.map((w) => w.text.trim()),
    ].filter(Boolean);

    if (itemsToUpgrade.length === 0) return;

    setIsBatchUpgrading(true);
    setBatchError(null);
    setBatchNotice(null);

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

      const results: { index: number; dutyText: string; text: string }[] = data.achievements ?? [];
      // itemsToUpgrade is exactly [...rawTasks, ...basicWins] in that order, and the route echoes
      // back each result's position in that same array - indexing back into rawTasks/basicWins by
      // that position is unambiguous even when two different duties have identical (or, past the
      // server's length cap, identically-truncated) text, which a text match alone can't tell apart.
      const proposals: BulletProposal[] = results.map((r) => {
        const isTask = r.index < rawTasks.length;
        const originalTaskText = isTask ? rawTasks[r.index] : undefined;
        const originalWin = isTask ? undefined : basicWins[r.index - rawTasks.length];
        return {
          key: `${r.index}`,
          originalText: originalTaskText ?? originalWin?.text ?? r.dutyText,
          suggestedText: r.text,
          originalTaskText,
          originalWin,
        };
      });

      // Nothing is applied here - proposals sit in review state below until the candidate accepts
      // or rejects each one (or all at once), so a batch that only partially succeeds (the route
      // caps at MAX_DUTY_TEXTS, and any single duty's generation can fail independently) never
      // silently drops or duplicates a bullet the way applying blind used to.
      if (proposals.length === 0) {
        setBatchError("Couldn't generate suggestions. Try again, or write them yourself.");
      } else {
        setPendingProposals(proposals);
        if (proposals.length < itemsToUpgrade.length) {
          setBatchNotice(
            `Got suggestions for ${proposals.length} of ${itemsToUpgrade.length} bullets - the rest couldn't be processed this round. Click the button again after reviewing to retry them.`
          );
        }
      }
    } catch {
      setBatchError("Something went wrong while upgrading bullets.");
    } finally {
      setIsBatchUpgrading(false);
    }
  }

  /** Drops exactly the one occurrence at `index` - a plain `filter(t => t !== value)` would drop
   * every rawTasks line with that same text, which is wrong when the description has two genuinely
   * duplicate lines and only one of them is the line this proposal is for. */
  function removeAt<T>(list: T[], index: number): T[] {
    return index === -1 ? list : list.filter((_, i) => i !== index);
  }

  function acceptProposal(proposal: BulletProposal) {
    if (proposal.originalTaskText) {
      onDescriptionChange(removeAt(rawTasks, rawTasks.indexOf(proposal.originalTaskText)).join("\n"));
      onWinsChange([...wins, { text: proposal.suggestedText, metric: "", what: proposal.originalTaskText }]);
      // Removing a line shifts every later rawTasks index, so an inline task editor open on a
      // different row (editingTaskIndex points at a position, not a stable identity) would end up
      // pointing at whatever shifted into that slot - close it rather than risk Save later
      // overwriting the wrong line with stale editor text.
      setEditingTaskIndex(null);
    } else if (proposal.originalWin) {
      onWinsChange(
        wins.map((w) => (w === proposal.originalWin ? { ...proposal.originalWin, text: proposal.suggestedText } : w))
      );
      // The win this proposal targets is being swapped for a new object - if that same win is
      // open in the inline editor, editingWin would now reference an object no longer in `wins`,
      // silently dropping the editor row and losing anything typed into it.
      if (editingWin === proposal.originalWin) {
        setEditingWin(null);
        setPolish(IDLE_POLISH);
      }
    } else {
      // Couldn't trace this suggestion back to a specific source line (the pooled matching above
      // should always prevent this, but never silently discard an accepted suggestion) - add it as
      // a new win instead of doing nothing.
      onWinsChange([...wins, { text: proposal.suggestedText, metric: "", what: proposal.originalText }]);
    }
    setPendingProposals((prev) => prev?.filter((p) => p !== proposal) ?? null);
  }

  function rejectProposal(proposal: BulletProposal) {
    setPendingProposals((prev) => prev?.filter((p) => p !== proposal) ?? null);
  }

  function acceptAllProposals() {
    if (!visibleProposals || visibleProposals.length === 0) return;

    const taskProposals = visibleProposals.filter((p) => p.originalTaskText);
    // Removes exactly one rawTasks line per proposal that names it, not every line with that text -
    // two proposals can legitimately share the same originalTaskText (genuine duplicate lines), and
    // a plain value filter would delete both for a single proposal's accept.
    const removalsRemaining = new Map<string, number>();
    for (const p of taskProposals) {
      const text = p.originalTaskText as string;
      removalsRemaining.set(text, (removalsRemaining.get(text) ?? 0) + 1);
    }
    const remainingTasks = rawTasks.filter((t) => {
      const remaining = removalsRemaining.get(t);
      if (!remaining) return true;
      removalsRemaining.set(t, remaining - 1);
      return false;
    });
    onDescriptionChange(remainingTasks.join("\n"));
    // Same reasoning as acceptProposal: removing lines shifts indices out from under any open
    // inline task editor.
    if (taskProposals.length > 0) setEditingTaskIndex(null);

    const newWinsFromTasks = taskProposals.map((p) => ({
      text: p.suggestedText,
      metric: "",
      what: p.originalTaskText,
    }));
    const winProposalsByOriginal = new Map(
      visibleProposals.filter((p) => p.originalWin).map((p) => [p.originalWin, p])
    );
    const updatedWins = wins.map((w) => {
      const match = winProposalsByOriginal.get(w);
      return match ? { ...w, text: match.suggestedText } : w;
    });
    // Same reasoning as acceptProposal: a win being replaced out from under an open inline editor
    // would leave editingWin pointing at an object no longer in `wins`.
    if (editingWin && winProposalsByOriginal.has(editingWin)) {
      setEditingWin(null);
      setPolish(IDLE_POLISH);
    }

    // Same never-silently-drop fallback as acceptProposal, for the "use all" path.
    const unmatched = visibleProposals.filter((p) => !p.originalTaskText && !p.originalWin);
    const newWinsFromUnmatched = unmatched.map((p) => ({
      text: p.suggestedText,
      metric: "",
      what: p.originalText,
    }));

    onWinsChange([...updatedWins, ...newWinsFromTasks, ...newWinsFromUnmatched]);

    setPendingProposals(null);
  }

  function rejectAllProposals() {
    setPendingProposals(null);
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
            onClick={async () => {
              if (await requireSignup("suggest")) return;
              setSuggestTasksOpen(true);
            }}
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
                  • {stripBulletPrefix(win.text) || "(empty bullet, tap to edit)"}
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

              {win.tools && win.tools.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-ink-muted">Add to Key skills:</span>
                  {win.tools.map((tool) => (
                    <button
                      key={tool}
                      type="button"
                      title={`Add "${tool}" to your key skills`}
                      className="rounded-pill border border-border px-2 py-0.5 text-[11px] font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent/40 hover:text-accent"
                      onClick={() => onAddSkills([tool])}
                    >
                      + {tool}
                    </button>
                  ))}
                </div>
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
                <p className="text-sm text-ink min-w-0 flex-1">• {stripBulletPrefix(task)}</p>
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

      <SignupAtGenerateModal
        isOpen={showSignupModal}
        defaultFullName={candidateFullName}
        badgeText={pendingAction === "suggest" ? "SUGGEST BULLETS" : "POLISH BULLETS"}
        title={
          pendingAction === "suggest"
            ? "Create your account to see suggestions"
            : "Create your account to polish"
        }
        subtitle={
          pendingAction === "suggest"
            ? "See typical tasks for this role immediately. Free to get started."
            : "Your bullets will be polished immediately. Free to get started."
        }
        submitLabel={pendingAction === "suggest" ? "Save & See Suggestions →" : "Save & Polish Bullets →"}
        onClose={() => setShowSignupModal(false)}
        onSuccess={() => {
          setShowSignupModal(false);
          if (pendingAction === "suggest") setSuggestTasksOpen(true);
          else if (pendingAction === "upgrade") runUpgradeAllBullets();
          setPendingAction(null);
        }}
      />

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
      {batchNotice && <p className="text-xs text-ink-secondary">{batchNotice}</p>}

      {visibleProposals && visibleProposals.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-accent-soft bg-accent-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-secondary">
              Review {visibleProposals.length} suggested bullet{visibleProposals.length === 1 ? "" : "s"}
            </p>
            <div className="flex shrink-0 gap-3">
              <button
                type="button"
                className="text-xs font-medium text-ink-secondary underline hover:text-ink"
                onClick={rejectAllProposals}
              >
                Keep all original
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-accent hover:text-accent/80"
                onClick={acceptAllProposals}
              >
                Use all suggestions
              </button>
            </div>
          </div>
          <ul className="flex flex-col gap-2.5">
            {visibleProposals.map((proposal) => (
              <li key={proposal.key} className="flex flex-col gap-1.5 rounded border border-border bg-surface p-2.5">
                <p className="text-xs text-ink-muted line-through">{proposal.originalText}</p>
                <p className="text-sm text-ink">{proposal.suggestedText}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-accent hover:text-accent/80"
                    onClick={() => acceptProposal(proposal)}
                  >
                    Use this wording
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-ink-secondary hover:text-ink"
                    onClick={() => rejectProposal(proposal)}
                  >
                    Keep original
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom Batch Upgrade Action */}
      <div className="mt-2 border-t border-border pt-4">
        <button
          type="button"
          disabled={totalCount === 0 || isBatchUpgrading || Boolean(visibleProposals?.length)}
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
