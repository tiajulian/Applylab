import type { ReviewItem } from "./types";

export type DiffKind = "same" | "add" | "del";
export interface DiffSegment {
  text: string;
  kind: DiffKind;
}

/** Words (with apostrophes), runs of whitespace, and single punctuation marks, so "65%" is "65" + "%". */
const TOKEN = /[\p{L}\p{N}_'’]+|\s+|[^\p{L}\p{N}_\s]/gu;
/** Past this many token pairs the O(n*m) table is not worth it; show the two texts as one replacement. */
const MAX_CELLS = 250_000;

const tokenize = (text: string) => text.match(TOKEN) ?? [];
const isSpace = (token: string) => /^\s+$/.test(token);

/** Appends a run to a flat DiffSegment list, merging into the last run when it's the same kind -
 * the one "append or extend" rule diffWords, diffMiddle, and sideSegments all apply while building
 * their own output list. */
function appendSegment(list: DiffSegment[], text: string, kind: DiffKind): void {
  const last = list[list.length - 1];
  if (last?.kind === kind) last.text += text;
  else list.push({ text, kind });
}

/** Word-level diff of two texts as a flat list of same / add / del runs (longest common subsequence). */
export function diffWords(from: string, to: string): DiffSegment[] {
  const all = tokenize(from);
  const allTo = tokenize(to);
  // Most edits touch a few words: only the stretch between the shared start and end needs the table.
  let head = 0;
  while (head < all.length && head < allTo.length && all[head] === allTo[head]) head++;
  let tail = 0;
  while (tail < all.length - head && tail < allTo.length - head && all[all.length - 1 - tail] === allTo[allTo.length - 1 - tail]) tail++;
  const a = all.slice(head, all.length - tail);
  const b = allTo.slice(head, allTo.length - tail);
  const same = (tokens: string[]): DiffSegment[] => (tokens.length ? [{ text: tokens.join(""), kind: "same" }] : []);
  const middle = diffMiddle(a, b);
  const out = [...same(all.slice(0, head)), ...middle, ...same(all.slice(all.length - tail))];
  // Adjacent runs of one kind (e.g. "same" around a trimmed edge) are one run.
  return out.reduce<DiffSegment[]>((merged, seg) => {
    appendSegment(merged, seg.text, seg.kind);
    return merged;
  }, []);
}

function diffMiddle(a: string[], b: string[]): DiffSegment[] {
  if (a.length * b.length > MAX_CELLS) return [{ text: a.join(""), kind: "del" }, { text: b.join(""), kind: "add" }];

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      appendSegment(out, a[i++], "same");
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) appendSegment(out, b[j++], "add");
    else appendSegment(out, a[i++], "del");
  }
  return out;
}

/**
 * One side of a diff: "add" shows the new text (same + added), "del" shows the old (same + removed).
 * A lone space between two changed runs joins them, so a rewritten phrase highlights as one block.
 */
export function sideSegments(diff: DiffSegment[], side: "add" | "del"): DiffSegment[] {
  const kept = diff.filter((s) => s.kind === "same" || s.kind === side);
  const out: DiffSegment[] = [];
  kept.forEach((seg, i) => {
    const bridge = seg.kind === "same" && isSpace(seg.text) && kept[i - 1]?.kind === side && kept[i + 1]?.kind === side;
    appendSegment(out, seg.text, bridge ? side : seg.kind);
  });
  return out;
}

export interface Comparison {
  /** The full text as it is on the resume now (or the candidate's own wording, for a rewrite). */
  original: string;
  /** The full suggested text; null when the item has no replacement to offer. */
  suggested: string | null;
  /** [start, end) of the flagged words in `original`, only when there is nothing to diff against. */
  flagged: [number, number] | null;
}

/**
 * The two full texts a card compares. A rewrite already carries both; a fix carries just the mistake,
 * so it is spliced into the block's current text. If the block has moved on since the analysis, the
 * card falls back to the stored words rather than showing a diff against text that is not there.
 */
export function buildComparison(item: ReviewItem, blockText: string): Comparison {
  if (item.kind === "change") return { original: item.before, suggested: item.after, flagged: null };
  const inPlace = blockText.slice(item.start, item.end) === item.before;
  if (!inPlace) return { original: item.before, suggested: item.after || null, flagged: null };
  if (!item.after) return { original: blockText, suggested: null, flagged: [item.start, item.end] };
  return { original: blockText, suggested: blockText.slice(0, item.start) + item.after + blockText.slice(item.end), flagged: null };
}
