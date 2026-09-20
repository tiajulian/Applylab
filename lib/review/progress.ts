import type { ReviewItem, ReviewKind } from "./types";

/** pending: still to decide. accepted / kept: decided (kept = the original stays, or a fix was dismissed). */
export type EntryState = "pending" | "accepted" | "kept";

/** A one-step way back for a decision that rewrote the block: put `to` back if the block still reads `from`. */
export interface UndoEdit {
  blockId: string;
  from: string;
  to: string;
}

/** One suggestion in the panel, whatever its state: this list is the single source of every count. */
export interface ReviewEntry {
  item: ReviewItem;
  state: EntryState;
  undo?: UndoEdit;
}

/** What this session decided. A fix stops matching once applied, and a reverted rewrite is "resolved",
 * so neither stays in the item list; the log keeps them on screen (as done rows) with their undo. */
export type DecisionLog = ReadonlyMap<string, ReviewEntry>;

/**
 * Merges the live items with the session's decisions into one ordered list.
 * An item's own status wins (open reopens a logged decision, e.g. after an undo elsewhere); the log
 * only fills in for items that are resolved or gone. A resolved item nobody decided on (the text was
 * edited by hand) is not a suggestion any more and is left out.
 */
export function buildEntries(items: ReviewItem[], log: DecisionLog, order: ReadonlyMap<string, number>): ReviewEntry[] {
  const byId = new Map<string, ReviewEntry>();
  for (const item of items) {
    const logged = log.get(item.id);
    if (item.status === "open") byId.set(item.id, { item, state: "pending" });
    else if (item.status === "accepted") byId.set(item.id, { item, state: "accepted", undo: logged?.undo });
    else if (item.status === "dismissed") byId.set(item.id, { item, state: "kept", undo: logged?.undo });
    else if (logged) byId.set(item.id, logged);
  }
  for (const [id, entry] of log) if (!byId.has(id)) byId.set(id, entry);
  const position = (e: ReviewEntry) => order.get(e.item.blockId) ?? 0;
  return [...byId.values()].sort((a, b) => position(a) - position(b) || a.item.start - b.item.start);
}

export interface ReviewProgress {
  total: number;
  reviewed: number;
  accepted: number;
  kept: number;
  /** Suggestions the AI added something new to, still waiting on the person. */
  verify: number;
}

export function reviewProgress(entries: ReviewEntry[]): ReviewProgress {
  let accepted = 0;
  let kept = 0;
  let verify = 0;
  for (const { state, item } of entries) {
    if (state === "accepted") accepted++;
    else if (state === "kept") kept++;
    else if (item.severity === "verify") verify++;
  }
  return { total: entries.length, reviewed: accepted + kept, accepted, kept, verify };
}

/** Pending rewrites that added nothing new: the ones "Accept N" may take. Never a new claim. */
export const bulkCandidates = (entries: ReviewEntry[]): ReviewItem[] =>
  entries.filter((e) => e.state === "pending" && e.item.kind === "change" && e.item.provenance === "reworded").map((e) => e.item);

/**
 * Which card opens next, after `exceptId` was dealt with: the same tab first, then the other tab, and
 * anything the person put off ("decide later") only once everything else is done.
 */
export function nextToReview(entries: ReviewEntry[], skipped: ReadonlySet<string>, tab: ReviewKind, exceptId?: string): ReviewItem | null {
  const pending = entries.filter((e) => e.state === "pending" && e.item.id !== exceptId).map((e) => e.item);
  const otherTab: ReviewKind = tab === "change" ? "fix" : "change";
  const queue = (isSkipped: boolean, kind: ReviewKind) => pending.filter((i) => skipped.has(i.id) === isSkipped && i.kind === kind);
  return [...queue(false, tab), ...queue(false, otherTab), ...queue(true, tab), ...queue(true, otherTab)][0] ?? null;
}
