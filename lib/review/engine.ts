import { MAX_LISTED_ITEMS, type RawReviewItem, type ReviewItem, type ReviewPassage } from "./types";

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Same rule + same block + same matched text (nth occurrence) always yields the same id, so status
 * and dismissals survive re-analysis and edits elsewhere in the block. */
export function assignIds(resumeId: string, raw: RawReviewItem[]): Array<RawReviewItem & { id: string }> {
  const seen = new Map<string, number>();
  return raw.map((item) => {
    const base = `${item.ruleId}:${item.blockId}:${hash((item.key ?? item.before).toLowerCase())}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...item, id: `${resumeId}:${base}:${n}` };
  });
}

export interface ReconcileInput {
  resumeId: string;
  prev: ReviewItem[];
  /** Fresh rule output for the analysed blocks only. */
  raw: RawReviewItem[];
  /** Blocks that were (re-)analysed; prev items elsewhere are carried over untouched. */
  analysedBlocks: ReadonlySet<string>;
  dismissed: ReadonlySet<string>;
  /** Accepted "keep as is" changes (no text edit to make them stop matching their rule). */
  kept: ReadonlySet<string>;
}

/**
 * Merges a new analysis into the existing list:
 * - a match stays open (or dismissed/kept when the user said so); a Fix that was accepted but matches
 *   again (undo, revert) reopens;
 * - an open item whose text no longer matches its rule becomes resolved;
 * - items outside `analysedBlocks` are untouched.
 */
export function reconcile({ resumeId, prev, raw, analysedBlocks, dismissed, kept }: ReconcileInput): ReviewItem[] {
  const next: ReviewItem[] = [];
  const matched = new Set<string>();

  for (const { key: _key, ...item } of assignIds(resumeId, raw)) {
    matched.add(item.id);
    const status = dismissed.has(item.id) ? "dismissed" : kept.has(item.id) ? "accepted" : "open";
    next.push({ ...item, resumeId, status });
  }

  for (const old of prev) {
    if (matched.has(old.id)) continue;
    if (!analysedBlocks.has(old.blockId)) next.push(old);
    else if (old.status === "open") next.push({ ...old, status: "resolved" });
    // Anything else that no longer matches (already-resolved, accepted fix, dismissed) is dropped:
    // dismissals live in the persisted set and reapply by id if the text ever comes back.
  }
  return next;
}

export const isOpen = (i: ReviewItem) => i.status === "open";
/** Only these are highlighted and counted by the chip; info items are listed in the panel only. */
export const isCounted = (i: ReviewItem) => i.status === "open" && i.severity !== "info";

/** Merges overlapping counted items in each block into one passage, coloured by the higher severity. */
export function buildPassages(items: ReviewItem[]): ReviewPassage[] {
  const byBlock = new Map<string, ReviewItem[]>();
  for (const item of items.filter(isCounted)) {
    const list = byBlock.get(item.blockId) ?? [];
    list.push(item);
    byBlock.set(item.blockId, list);
  }
  const passages: ReviewPassage[] = [];
  for (const [blockId, list] of byBlock) {
    let current: ReviewPassage | null = null;
    for (const item of [...list].sort((a, b) => a.start - b.start || a.end - b.end)) {
      const severity = item.severity as ReviewPassage["severity"];
      if (current && item.start < current.end) {
        current.end = Math.max(current.end, item.end);
        current.itemIds.push(item.id);
        if (severity === "verify") current.severity = "verify";
      } else {
        current = { blockId, start: item.start, end: item.end, severity, itemIds: [item.id] };
        passages.push(current);
      }
    }
  }
  return passages;
}

/** The chip number: distinct highlighted passages, so it can never disagree with the preview. */
export const countPassages = (items: ReviewItem[]) => buildPassages(items).length;
export const countVerify = (items: ReviewItem[]) => items.filter((i) => isCounted(i) && i.severity === "verify").length;

export function tabItems(items: ReviewItem[], tab: "change" | "fix", status: "open" | "dismissed" = "open") {
  return items.filter((i) => i.kind === tab && i.status === status);
}

/** Display cap: the first `limit` items (already in document order) plus how many are hidden. */
export function capItems<T>(items: T[], limit = MAX_LISTED_ITEMS): { shown: T[]; hidden: number } {
  return { shown: items.slice(0, limit), hidden: Math.max(0, items.length - limit) };
}
