/**
 * Bold/italic formatting for a resume bullet, stored as markdown-style markers directly inside
 * the bullet's own plain string (no ResumeContent schema change): "**bold**", "*italic*", and
 * "***both***" (an opening run of 3 asterisks toggles both at once - this is what wrapping an
 * already-italic selection in bold, or vice versa, naturally produces). No nesting beyond
 * bold+italic together - a run is either off, bold, italic, or both.
 *
 * Every function here is pure (no React/DOM), so this module is the single place that
 * understands the marker grammar. Everywhere else either:
 * - renders it (components/templates/shared.tsx's renderBulletRuns for PDF/HTML,
 *   lib/export/resumeDocx.ts's bulletParagraph for DOCX, EditableBullet for the live canvas), or
 * - needs the plain semantic text and calls stripBulletMarkup first (spellcheck, content-quality
 *   checks, the AI-assist prompt, the review word-diff - see each call site's own comment for why).
 *
 * Known, accepted limitation: a literal "*" a candidate types as ordinary prose (rare) would be
 * misread as a marker. Markers are only ever inserted programmatically, via the selection
 * toolbar's Bold/Italic buttons - never by interpreting a character the person typed themselves -
 * which keeps this rare in practice. The parser is tolerant of an unmatched marker (it just stays
 * "on" for the rest of the string) rather than throwing or corrupting text.
 */

export interface BulletRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** A BulletRun plus where it sits in both coordinate spaces - the stored marked-up string
 * (markedStart/End) and the plain text a reader/DOM/review-rule actually sees (plainStart/End).
 * Internal: every public function is built on top of this one scan. */
interface ScannedRun extends BulletRun {
  markedStart: number;
  markedEnd: number;
  plainStart: number;
  plainEnd: number;
}

function scanRuns(marked: string): ScannedRun[] {
  const runs: ScannedRun[] = [];
  let bold = false;
  let italic = false;
  let buffer = "";
  let bufferMarkedStart = 0;
  let plainPos = 0;
  let i = 0;

  const flush = (markedEnd: number) => {
    if (!buffer) return;
    runs.push({ text: buffer, bold, italic, markedStart: bufferMarkedStart, markedEnd, plainStart: plainPos, plainEnd: plainPos + buffer.length });
    plainPos += buffer.length;
    buffer = "";
  };

  while (i < marked.length) {
    if (marked[i] !== "*") {
      if (!buffer) bufferMarkedStart = i;
      buffer += marked[i];
      i++;
      continue;
    }
    let count = 0;
    while (marked[i + count] === "*") count++;
    // A run of more than 3 is not a marker this grammar defines - only the first 3 toggle state,
    // any further asterisks are literal text (tolerant of a stray "****" rather than erroring).
    const marker = Math.min(count, 3);
    flush(i);
    if (marker === 3) {
      bold = !bold;
      italic = !italic;
    } else if (marker === 2) {
      bold = !bold;
    } else if (marker === 1) {
      italic = !italic;
    }
    i += marker;
    const extra = count - marker;
    if (extra > 0) {
      bufferMarkedStart = i;
      buffer = "*".repeat(extra);
      i += extra;
    }
  }
  flush(marked.length);
  return runs;
}

/** The bullet's formatting as an ordered list of runs, ready to render (PDF/HTML's renderBulletRuns,
 * DOCX's bulletParagraph, EditableBullet's DOM). Never throws on malformed/unmatched markers. */
export function parseBulletMarkup(marked: string): BulletRun[] {
  return scanRuns(marked).map(({ text, bold, italic }) => ({ text, bold, italic }));
}

/** The bullet's plain semantic text, markers removed - what spellcheck, content-quality checks,
 * the AI-assist prompt, and the review word-diff should always operate on instead of the raw
 * stored string (see this module's own top comment for why). */
export function stripBulletMarkup(marked: string): string {
  return scanRuns(marked)
    .map((r) => r.text)
    .join("");
}

/**
 * The inverse of parseBulletMarkup: turns an ordered list of runs back into a marked-up string.
 * Walks state *transitions* between consecutive runs rather than wrapping each run in its own
 * self-contained marker pair - wrapping independently is what breaks when two runs land adjacently
 * with no plain-text character between them (e.g. an italic run ending exactly where a bold+italic
 * run begins): that would emit one run's closing marker immediately followed by the next run's
 * opening marker, a total asterisk count that no longer means what either side intended
 * (parseBulletMarkup only ever sees a flat count, not which side of a boundary each star came
 * from). A toggle is its own inverse, so exactly one marker per transition (1 star = italic only,
 * 2 = bold only, 3 = both) always exists and is unambiguous - there is never more than one marker
 * run between any two runs, so this can't happen. Used by insertMarkupAroundSelection below, and
 * by EditableBullet's domToMarkup (components/templates/shared.tsx) to turn the live contentEditable
 * DOM's per-node bold/italic state back into the stored string on every edit. */
export function serializeBulletRuns(runs: BulletRun[]): string {
  let out = "";
  let curBold = false;
  let curItalic = false;
  const emitTransition = (nextBold: boolean, nextItalic: boolean) => {
    if (nextBold === curBold && nextItalic === curItalic) return;
    if (nextBold !== curBold && nextItalic !== curItalic) out += "***";
    else if (nextBold !== curBold) out += "**";
    else out += "*";
    curBold = nextBold;
    curItalic = nextItalic;
  };
  for (const run of runs) {
    if (!run.text) continue;
    emitTransition(run.bold, run.italic);
    out += run.text;
  }
  emitTransition(false, false);
  return out;
}

/** Converts an offset into the plain (marker-stripped) text into the matching offset into the
 * stored marked-up string. Used wherever a plain-text position (a DOM Range/selection offset, or
 * a review rule's match position) needs to be located inside the real stored string - e.g.
 * insertMarkupAroundSelection below, or splicing a review-passage boundary into a rendered run. A
 * plain offset that lands inside a marker itself (there is no such text) snaps to the nearer edge
 * of the run it borders. */
export function plainToMarkedOffset(marked: string, plainOffset: number): number {
  const runs = scanRuns(marked);
  for (const run of runs) {
    if (plainOffset <= run.plainEnd) {
      return run.markedStart + Math.max(0, plainOffset - run.plainStart);
    }
  }
  return marked.length;
}

/** The inverse of plainToMarkedOffset: an offset into the stored marked-up string to the matching
 * offset into its plain (marker-stripped) text. An offset that lands inside a marker itself snaps
 * to the nearer edge of the run it borders. */
export function markedToPlainOffset(marked: string, markedOffset: number): number {
  const runs = scanRuns(marked);
  for (const run of runs) {
    if (markedOffset <= run.markedEnd) {
      return run.plainStart + Math.max(0, Math.min(markedOffset - run.markedStart, run.text.length));
    }
  }
  return runs.length ? runs[runs.length - 1].plainEnd : 0;
}

/** Whether every character in a plain-text offset range already carries the given attribute - the
 * same "is this selection already fully formatted" question insertMarkupAroundSelection answers
 * internally to decide toggle direction, exposed here for the selection toolbar's own aria-pressed
 * state (so Bold/Italic show pressed only when clicking them would remove the formatting, not
 * apply it to the rest of a partially-formatted selection). False for a collapsed or empty range. */
export function isRangeFormatted(marked: string, start: number, end: number, kind: "bold" | "italic"): boolean {
  if (start >= end) return false;
  const isBold = kind === "bold";
  let covered = 0;
  for (const run of scanRuns(marked)) {
    const s = Math.max(run.plainStart, start);
    const e = Math.min(run.plainEnd, end);
    if (s >= e) continue;
    if (!(isBold ? run.bold : run.italic)) return false;
    covered += e - s;
  }
  return covered === end - start;
}

/**
 * Toggles bold or italic over a *plain-text* offset range [start, end) of `marked` (the current
 * stored marked-up string), returning the new stored string. Standard WYSIWYG toggle semantics:
 * if the whole selection already carries the attribute, it's cleared everywhere in the selection;
 * otherwise it's applied everywhere in the selection (even where only part of it already had it) -
 * never a mixed/partial result the person would need a second click to "finish".
 *
 * Implementation always rebuilds the marked string from a flat per-segment plain-text state array
 * (split the existing runs at the selection's start/end, flip the target attribute on every
 * segment now fully inside the selection, merge back, re-serialize) rather than surgically
 * splicing markers into the existing string in place. Rebuilding from a flat state array sidesteps
 * every "selection starts mid-way through an existing bold/italic run" edge case by construction -
 * there is no nesting to reason about, only a flat sequence of (text, bold, italic) segments.
 *
 * start/end are returned unchanged: toggling markers never changes the plain text itself, only
 * where markers sit in the stored string, so the caller's plain-text selection stays valid as-is
 * (see EditableBullet's setSelectionByPlainOffsets, which restores selection using these).
 */
export function insertMarkupAroundSelection(
  marked: string,
  start: number,
  end: number,
  kind: "bold" | "italic"
): { text: string; start: number; end: number } {
  if (start > end) [start, end] = [end, start];
  const plainLength = stripBulletMarkup(marked).length;
  start = Math.max(0, Math.min(start, plainLength));
  end = Math.max(0, Math.min(end, plainLength));
  if (start === end) return { text: marked, start, end };

  interface Seg {
    text: string;
    plainStart: number;
    plainEnd: number;
    bold: boolean;
    italic: boolean;
  }

  const segs: Seg[] = [];
  for (const run of scanRuns(marked)) {
    const splitPoints = [start, end].filter((p) => p > run.plainStart && p < run.plainEnd);
    const bounds = [run.plainStart, ...splitPoints.sort((a, b) => a - b), run.plainEnd];
    for (let i = 0; i < bounds.length - 1; i++) {
      const s = bounds[i];
      const e = bounds[i + 1];
      if (s === e) continue;
      segs.push({ text: run.text.slice(s - run.plainStart, e - run.plainStart), plainStart: s, plainEnd: e, bold: run.bold, italic: run.italic });
    }
  }

  const isBold = kind === "bold";
  const selected = segs.filter((s) => s.plainStart >= start && s.plainEnd <= end);
  const alreadyAllOn = selected.length > 0 && selected.every((s) => (isBold ? s.bold : s.italic));
  const nextValue = !alreadyAllOn;
  for (const s of selected) {
    if (isBold) s.bold = nextValue;
    else s.italic = nextValue;
  }

  // Merge adjacent segments that ended up with identical state, so toggling doesn't fragment the
  // string into more marker pairs than necessary (e.g. "**a****b**" instead of one "**ab**").
  const merged: Seg[] = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === s.bold && last.italic === s.italic) {
      last.text += s.text;
      last.plainEnd = s.plainEnd;
    } else {
      merged.push({ ...s });
    }
  }

  return { text: serializeBulletRuns(merged), start, end };
}
