"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { WinBuilder } from "@/components/profile/WinBuilder";
import { SuggestTasksBuilder } from "@/components/profile/SuggestTasksBuilder";
import { LinePicksDialog, type LinePickResult, type PickLine } from "@/components/profile/LinePicksDialog";
import { MAX_PICK_LINES, saveNewPicksToProfile } from "@/lib/profile/pickOptions";
import { showMetric } from "@/lib/profile/metricDisplay";
import { useAccountGate, type AccountGateCopy } from "@/components/auth/AccountGate";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { checkSlotCoverage } from "@/lib/wins/dutyCoverage";
import { isWinEmpty } from "@/lib/profile/emptyEntry";
import { stripBulletPrefix } from "@/lib/text/cleanBullet";
import { findRepeatedBullets, type BulletFlag } from "@/lib/text/bulletSimilarity";
import type { UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";
import type { WorkExperienceWin } from "@/types";
import { CopyIcon, PencilIcon, SparklesIcon, TrashIcon, LightbulbIcon } from "@/components/ui/icons/LucideIcons";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { refreshFreeUsage, useFreeUsesLeft } from "@/lib/hooks/useFreeUsesLeft";

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
  /** The line's tools/people as sent to the rewrite - kept on the line when the proposal is used. */
  tools: string[];
  stakeholders: string[];
}

/** One line "Improve all the wording" rewrites: a raw task line or a win without a metric. */
interface UpgradeItem {
  key: string;
  text: string;
  taskText?: string;
  win?: WorkExperienceWin;
  tools: string[];
  stakeholders: string[];
}

/** A win with a proposal's text and exactly the tools/people the line was rewritten with - so a
 * pick the candidate unticked in "Add tools or teams?" is dropped, not kept from the old win. */
function winFromProposal(base: WorkExperienceWin, proposal: BulletProposal): WorkExperienceWin {
  return { ...base, text: proposal.suggestedText, tools: proposal.tools, stakeholders: proposal.stakeholders };
}

async function requestPolish(
  win: WorkExperienceWin,
  roleTitle: string,
  roleCompany: string
): Promise<{ suggestion: string; driftFlags: string[] } | { error: string; code?: string }> {
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
  if (!response.ok) return { error: data.error ?? "Something went wrong. Please try again.", code: data.code };
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

const ROW_CARD = "flex flex-col gap-1.5 rounded border p-3";

/** Card colours for a row: red for an exact repeat (certain), amber for a similar one (a judgement
 * call the candidate should check), plain otherwise. */
function rowCardClass(flag: BulletFlag | null): string {
  if (!flag) return `${ROW_CARD} border-border bg-surface`;
  return flag.kind === "duplicate"
    ? `${ROW_CARD} border-critical/40 bg-critical-soft`
    : `${ROW_CARD} border-attention/40 bg-attention-soft`;
}

/** Footer on a row that repeats another line: what's wrong on the left, the one fix on the right. */
function RepeatNote({ flag, otherText, onRemove }: { flag: BulletFlag; otherText: string; onRemove: () => void }) {
  const isDuplicate = flag.kind === "duplicate";
  const snippet = stripBulletPrefix(otherText);
  return (
    <div
      className={`mt-0.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2 ${
        isDuplicate ? "border-critical/20" : "border-attention/20"
      }`}
    >
      <p
        className={`flex min-w-0 items-center gap-1.5 text-xs font-medium ${
          isDuplicate ? "text-critical" : "text-attention"
        }`}
      >
        <CopyIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {isDuplicate
          ? "This line appears twice"
          : `Similar to “${snippet.length > 40 ? `${snippet.slice(0, 40).trimEnd()}…` : snippet}”`}
      </p>
      <button
        type="button"
        onClick={onRemove}
        className={`shrink-0 rounded-pill border bg-surface px-3 py-1 text-xs font-semibold transition-colors ${
          isDuplicate
            ? "border-critical/40 text-critical hover:bg-critical/10"
            : "border-attention/40 text-attention hover:bg-attention/10"
        }`}
      >
        Remove this copy
      </button>
    </div>
  );
}

/** One raw (not-yet-a-win) task row. */
function TaskRow({
  task,
  onEdit,
  onDelete,
  onOpenBuilder,
  repeatNote,
  cardClass,
}: {
  task: string;
  onEdit: () => void;
  onDelete: () => void;
  onOpenBuilder: () => void;
  repeatNote: ReactNode;
  cardClass: string;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink min-w-0 flex-1">• {stripBulletPrefix(task)}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-ink-secondary hover:text-ink"
            onClick={onEdit}
          >
            <><PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />Edit</>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-critical hover:underline"
            onClick={onDelete}
          >
            <><TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />Delete</>
          </button>
        </div>
      </div>

      {/* A flagged copy is about to be removed - offering to improve it would compete with that. */}
      {!repeatNote && (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 self-start rounded-sm text-[13px] font-medium text-accent-hover transition-colors hover:underline"
          onClick={onOpenBuilder}
        >
          <><SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />Make this stronger with AI</>
        </button>
      )}

      {repeatNote}
    </div>
  );
}

const GATE_COPY = {
  suggest: {
    title: "Create your free account to see suggested duties",
    submitLabel: "Create account & see suggestions",
  },
  improveOne: {
    title: "Create your free account to improve this line",
    submitLabel: "Create account & improve it",
  },
  improveAll: {
    title: "Create your free account to improve your wording",
    submitLabel: "Create account & improve wording",
  },
} satisfies Record<string, AccountGateCopy>;

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
  // True only when this task's tools were just picked in SuggestTasksBuilder.tsx - see
  // WinBuilder's skipToolsStep prop for why this can't just be inferred from the win/duty already
  // having tools.
  const [builderSkipToolsStep, setBuilderSkipToolsStep] = useState(false);
  const [removingWin, setRemovingWin] = useState<WorkExperienceWin | null>(null);
  const [suggestTasksOpen, setSuggestTasksOpen] = useState(false);
  const [isBatchUpgrading, setIsBatchUpgrading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [pendingProposals, setPendingProposals] = useState<BulletProposal[] | null>(null);
  // The optional "Add tools or teams?" step: the lines to ask about, and every line to rewrite after.
  const [pickStep, setPickStep] = useState<{ lines: PickLine[]; items: UpgradeItem[] } | null>(null);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const bulletifyUsesLeft = useFreeUsesLeft("role-duties-bulletify");
  const [limitReachedFeature, setLimitReachedFeature] = useState<"win-polish" | "role-duties-bulletify" | null>(null);
  // Exact repeats are always flagged; reworded ones only once "Improve all" has run, since the
  // looser match can misfire and is most useful when the candidate is already reviewing wording.
  const [checkSimilar, setCheckSimilar] = useState(false);

  // Guests can type freely; each AI action below asks them to sign up first (enforced server-side
  // by requirePermanentUser) and carries on by itself once they have.
  const { requireAccount } = useAccountGate();

  const rawTasks = splitTasks(description);
  const totalCount = wins.filter((win) => !isWinEmpty(win)).length + rawTasks.length;
  // Display order: every win, then every raw task - so flag index i < wins.length is wins[i],
  // otherwise rawTasks[i - wins.length].
  const listTexts = [...wins.map((w) => w.text), ...rawTasks];
  const repeatFlags = findRepeatedBullets(
    listTexts.map((text, i) => ({ text, hasMetric: i < wins.length && Boolean(wins[i].metric) })),
    checkSimilar
  );
  function repeatNoteFor(listIndex: number, onRemove: () => void) {
    const flag = repeatFlags[listIndex];
    return flag ? <RepeatNote flag={flag} otherText={listTexts[flag.of]} onRemove={onRemove} /> : null;
  }
  // Keyed by a duty's effective text, rebuilt only when duties.items changes rather than scanned
  // fresh (an O(items) .find) for every rawTask row on every render - including every keystroke of
  // an unrelated inline task/win edit elsewhere in this same list.
  const dutyByText = useMemo(() => {
    const map = new Map<string, (typeof duties.items)[number]>();
    for (const item of duties.items) {
      map.set(item.user_edited_text?.trim() || item.duty_text, item);
    }
    return map;
    // Deliberately `duties.items`, not `duties` - useRoleDuties.ts returns a new object literal
    // every render, so depending on the whole hook result would rebuild this map every render too
    // and defeat the memoization; `duties.items` is the one field on it that's referentially
    // stable except when the array itself actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duties.items]);
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

  function openInBuilder(win: WorkExperienceWin, skipToolsStep = false) {
    setEditingWin(null);
    setPolish(IDLE_POLISH);
    setBuilderTarget(win);
    setBuilderSkipToolsStep(skipToolsStep);
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
    if (!(await requireAccount(GATE_COPY.improveOne))) return;
    setPolish({ isLoading: true, suggestion: null, driftFlags: [], error: null });
    const result = await requestPolish(editingWin, jobTitle, company);
    refreshFreeUsage();
    if ("error" in result) {
      if (result.code === "FREE_LIMIT_REACHED") {
        setPolish({ isLoading: false, suggestion: null, driftFlags: [], error: null });
        setLimitReachedFeature("win-polish");
        return;
      }
      setPolish({ isLoading: false, suggestion: null, driftFlags: [], error: result.error });
      return;
    }
    setPolish({ isLoading: false, suggestion: result.suggestion, driftFlags: result.driftFlags, error: null });
  }

  function acceptPolish() {
    if (!polish.suggestion) return;
    updateEditingWin({ text: polish.suggestion });
  }

  function buildUpgradeItems(): UpgradeItem[] {
    const taskItems = rawTasks
      .filter((task) => task.trim())
      .map((task, i) => {
        const duty = dutyByText.get(task);
        return { key: `task-${i}`, text: task.trim(), taskText: task, tools: duty?.tools ?? [], stakeholders: duty?.stakeholders ?? [] };
      });
    const winItems = wins
      .filter((w) => !w.metric && w.text.trim())
      .map((win, i) => ({ key: `win-${i}`, text: win.text.trim(), win, tools: win.tools ?? [], stakeholders: win.stakeholders ?? [] }));
    return [...taskItems, ...winItems];
  }

  async function handleUpgradeAllBullets() {
    if (!(await requireAccount(GATE_COPY.improveAll))) return;
    const items = buildUpgradeItems();
    if (items.length === 0) return;
    // Out of free uses: say so now, before spending an AI call and the candidate's time on picks.
    if (bulletifyUsesLeft === 0) {
      setLimitReachedFeature("role-duties-bulletify");
      return;
    }

    setIsLoadingPicks(true);
    setBatchError(null);
    setBatchNotice(null);

    // The optional picks step. Free, and never a blocker: any failure here just means no picks, and
    // the rewrite runs straight away as it always did.
    const askable = items.slice(0, MAX_PICK_LINES);
    let lines: PickLine[] = [];
    try {
      const response = await fetch("/api/role-duties/line-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: askable.map((item) => item.text), jobTitle, company }),
      });
      const data = await response.json().catch(() => ({}));
      const picks: { tools: string[]; stakeholders: string[] }[] = response.ok && Array.isArray(data.picks) ? data.picks : [];
      lines = askable
        .map((item, i) => ({
          key: item.key,
          text: item.text,
          suggestedTools: picks[i]?.tools ?? [],
          suggestedStakeholders: picks[i]?.stakeholders ?? [],
          tools: item.tools,
          stakeholders: item.stakeholders,
        }))
        .filter((line) => line.suggestedTools.length > 0 || line.suggestedStakeholders.length > 0);
    } catch {
      // No picks - fall through to the rewrite.
    } finally {
      setIsLoadingPicks(false);
    }

    if (lines.length === 0) {
      await runUpgradeAllBullets(items);
      return;
    }
    setPickStep({ lines, items });
  }

  function improveWithPicks(result: LinePickResult | null) {
    if (!pickStep) return;
    // Picks reach the profile lists only when a proposal using them is accepted (savePicks).
    const items = result
      ? pickStep.items.map((item) => (result[item.key] ? { ...item, ...result[item.key] } : item))
      : pickStep.items;
    setPickStep(null);
    void runUpgradeAllBullets(items);
  }

  async function runUpgradeAllBullets(itemsToUpgrade: UpgradeItem[]) {
    setIsBatchUpgrading(true);
    setBatchError(null);
    setBatchNotice(null);

    try {
      const response = await fetch("/api/role-duties/generate-achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dutyTexts: itemsToUpgrade.map((item) => item.text),
          toolsByIndex: itemsToUpgrade.map((item) => item.tools),
          stakeholdersByIndex: itemsToUpgrade.map((item) => item.stakeholders),
          jobTitle,
          company,
        }),
      });

      const data = await response.json().catch(() => ({}));
      refreshFreeUsage();
      if (!response.ok) {
        if (data.code === "FREE_LIMIT_REACHED") {
          setLimitReachedFeature("role-duties-bulletify");
          setIsBatchUpgrading(false);
          return;
        }
        setBatchError(data.error ?? "Failed to upgrade bullets.");
        setIsBatchUpgrading(false);
        return;
      }

      const results: { index: number; dutyText: string; text: string }[] = data.achievements ?? [];
      // The route echoes back each result's position in itemsToUpgrade - indexing back by that
      // position is unambiguous even when two different lines have identical (or, past the
      // server's length cap, identically-truncated) text, which a text match alone can't tell apart.
      const proposals: BulletProposal[] = results.map((r) => {
        const item = itemsToUpgrade[r.index];
        return {
          key: `${r.index}`,
          originalText: item?.taskText ?? item?.win?.text ?? r.dutyText,
          suggestedText: r.text,
          originalTaskText: item?.taskText,
          originalWin: item?.win,
          tools: item?.tools ?? [],
          stakeholders: item?.stakeholders ?? [],
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
        setCheckSimilar(true);
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

  /** The candidate kept these lines' new wording, so their tools/people are confirmed: save any new ones to the profile lists. */
  function savePicks(proposals: BulletProposal[]) {
    saveNewPicksToProfile(proposals.map((p) => p.tools), tools, onAddTool);
    saveNewPicksToProfile(proposals.map((p) => p.stakeholders), stakeholders, onAddStakeholder);
  }

  function acceptProposal(proposal: BulletProposal) {
    savePicks([proposal]);
    if (proposal.originalTaskText) {
      onDescriptionChange(removeAt(rawTasks, rawTasks.indexOf(proposal.originalTaskText)).join("\n"));
      onWinsChange([...wins, winFromProposal({ text: "", metric: "", what: proposal.originalTaskText }, proposal)]);
      // Removing a line shifts every later rawTasks index, so an inline task editor open on a
      // different row (editingTaskIndex points at a position, not a stable identity) would end up
      // pointing at whatever shifted into that slot - close it rather than risk Save later
      // overwriting the wrong line with stale editor text.
      setEditingTaskIndex(null);
    } else if (proposal.originalWin) {
      onWinsChange(
        wins.map((w) => (w === proposal.originalWin ? winFromProposal(w, proposal) : w))
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
    savePicks(visibleProposals);

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

    const newWinsFromTasks = taskProposals.map((p) => winFromProposal({ text: "", metric: "", what: p.originalTaskText }, p));
    const winProposalsByOriginal = new Map(
      visibleProposals.filter((p) => p.originalWin).map((p) => [p.originalWin, p])
    );
    const updatedWins = wins.map((w) => {
      const match = winProposalsByOriginal.get(w);
      return match ? winFromProposal(w, match) : w;
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
        <h3 className="text-[15px] font-semibold text-ink">
          What you did in this job <span className="font-normal text-ink-muted">({totalCount})</span>
        </h3>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button type="button" variant="outline" size="sm" onClick={writeALine}>
            + Add a line
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              if (!(await requireAccount(GATE_COPY.suggest))) return;
              setSuggestTasksOpen(true);
            }}
          >
            <LightbulbIcon className="h-4 w-4" /> Suggest duties
            <FreeUsesLeft feature="role-duties-suggest" />
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
                    aria-label="Edit this bullet"
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
                    {polish.isLoading ? "Improving…" : <>Improve wording<FreeUsesLeft feature="win-polish" /></>}
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
                      {showMetric(polish.suggestion, win.metric) && <span className="text-ink-secondary">, {win.metric}</span>}
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
            <div key={`win-${index}`} className={rowCardClass(repeatFlags[index])}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-ink min-w-0 flex-1">
                  • {stripBulletPrefix(win.text) || "(empty line, tap to edit)"}
                  {showMetric(win.text, win.metric) && <span className="text-ink-secondary"> ({win.metric})</span>}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-ink-secondary hover:text-ink"
                    onClick={() => openEditWin(win)}
                  >
                    <><PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />Edit</>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-critical hover:underline"
                    onClick={() => requestRemoveWin(win)}
                  >
                    <><TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />Delete</>
                  </button>
                </div>
              </div>

              {isBasic && !repeatFlags[index] && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 self-start rounded-sm text-[13px] font-medium text-accent-hover transition-colors hover:underline"
                  onClick={() => openInBuilder(win)}
                >
                  <><SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />Make this stronger with AI</>
                </button>
              )}

              {repeatNoteFor(index, () => requestRemoveWin(win))}
            </div>
          );
        })}

        {/* Render Raw Tasks from Description */}
        {rawTasks.map((task, index) =>
          editingTaskIndex === index ? (
            <div key={`task-${index}`} className="flex flex-col gap-2 rounded border border-border bg-surface p-3">
              <Textarea
                aria-label="Edit this task"
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
            <TaskRow
              key={`task-${index}`}
              task={task}
              onEdit={() => {
                setEditingTaskIndex(index);
                setEditingTaskText(task);
              }}
              onDelete={() => removeTask(index)}
              onOpenBuilder={() => {
                const dutyTools = dutyByText.get(task)?.tools ?? [];
                openInBuilder(
                  {
                    text: task,
                    metric: "",
                    what: task,
                    ...(dutyTools.length > 0 ? { tools: dutyTools } : {}),
                  },
                  dutyTools.length > 0
                );
              }}
              repeatNote={repeatNoteFor(wins.length + index, () => removeTask(index))}
              cardClass={rowCardClass(repeatFlags[wins.length + index])}
            />
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
          skipToolsStep={builderSkipToolsStep}
          onSave={handleBuilderSave}
          onClose={() => setBuilderTarget(null)}
        />
      )}

      <LimitReachedModal
        isOpen={limitReachedFeature !== null}
        onClose={() => setLimitReachedFeature(null)}
        title={
          limitReachedFeature === "role-duties-bulletify"
            ? "You've used your free duty rewrites"
            : "You've used your free achievement improvements"
        }
        message={
          limitReachedFeature === "role-duties-bulletify"
            ? "Go Pro to turn duties into achievements on every role."
            : "Go Pro to improve unlimited achievements."
        }
      />

      {suggestTasksOpen && (
        <SuggestTasksBuilder
          jobTitle={jobTitle}
          company={company}
          location={location}
          duties={duties}
          existingTaskTexts={rawTasks}
          profileTools={tools}
          onAddProfileTool={onAddTool}
          profileStakeholders={stakeholders}
          onAddProfileStakeholder={onAddStakeholder}
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
              Review {visibleProposals.length} suggested change{visibleProposals.length === 1 ? "" : "s"}
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
          disabled={totalCount === 0 || isBatchUpgrading || isLoadingPicks || Boolean(pickStep) || Boolean(visibleProposals?.length)}
          onClick={handleUpgradeAllBullets}
          className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-center text-accent-hover transition-colors hover:border-accent/50 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBatchUpgrading || isLoadingPicks ? (
            <>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <>
                  <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                  {isLoadingPicks ? "Looking for tools and teams…" : "Improving your wording…"}
                </>
              </span>
              <span className="text-xs font-normal text-ink-secondary">
                {isLoadingPicks
                  ? "You can add any that fit before the rewrite"
                  : "Fixing spelling, tense and the first word of each line"}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">
                <><SparklesIcon className="mr-1 inline h-4 w-4" aria-hidden="true" />Improve all the wording with AI<FreeUsesLeft feature="role-duties-bulletify" /></>
              </span>
              <span className="text-xs font-normal text-ink-secondary">
                Fixes grammar, cuts job-ad wording and starts each line with a strong verb. You choose what to keep.
              </span>
            </>
          )}
        </button>
      </div>

      {pickStep && (
        <LinePicksDialog
          lines={pickStep.lines}
          profileTools={tools}
          profileStakeholders={stakeholders}
          onImprove={improveWithPicks}
          onSkip={() => improveWithPicks(null)}
          onClose={() => setPickStep(null)}
        />
      )}

      {removingWin && (
        <ConfirmDialog
          title="Remove this line?"
          description="This can't be undone."
          confirmLabel="Remove line"
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
