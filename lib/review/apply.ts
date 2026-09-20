import type { ResumeContent } from "@/types";
import { listBlocks, setBlockText } from "./blocks";
import type { ReviewItem } from "./types";

export const blockText = (content: ResumeContent, blockId: string) => listBlocks(content).find((b) => b.id === blockId)?.text;

/** Replaces the flagged range with the fix. Null when there is nothing to apply or the text has moved on. */
export function applyFix(content: ResumeContent, item: ReviewItem): ResumeContent | null {
  const result = applyFixes(content, [item]);
  return result.applied.length ? result.content : null;
}

/** Applies many fixes in one pass. Within a block they go last-to-first so earlier offsets stay valid;
 * a fix whose text has changed, or that overlaps one already applied, is skipped. */
export function applyFixes(content: ResumeContent, items: ReviewItem[]): { content: ResumeContent; applied: ReviewItem[] } {
  const applied: ReviewItem[] = [];
  let next = content;
  const byBlock = new Map<string, ReviewItem[]>();
  for (const item of items) {
    if (item.kind !== "fix" || !item.after) continue;
    byBlock.set(item.blockId, [...(byBlock.get(item.blockId) ?? []), item]);
  }
  for (const [blockId, list] of byBlock) {
    let text = blockText(next, blockId);
    if (text === undefined) continue;
    let floor = Infinity;
    for (const item of [...list].sort((a, b) => b.start - a.start)) {
      if (item.end > floor || text.slice(item.start, item.end) !== item.before) continue;
      text = text.slice(0, item.start) + item.after + text.slice(item.end);
      floor = item.start;
      applied.push(item);
    }
    next = setBlockText(next, blockId, text);
  }
  return { content: next, applied };
}

/** Puts a Change's block back to the candidate's own wording. Null without a known original, or if
 * the bullet has been edited since (the card would be showing stale text). */
export function revertChange(content: ResumeContent, item: ReviewItem): ResumeContent | null {
  if (item.kind !== "change" || !item.before || blockText(content, item.blockId) !== item.after) return null;
  const next = setBlockText(content, item.blockId, item.before);
  return next === content ? null : next;
}
