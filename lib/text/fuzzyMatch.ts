// Forgiving "as you type" matching for suggestion dropdowns (tools, places): prefixes of the name
// or of any word in it, then small typos, so a half-typed or misspelled name still finds its match.

/** Lowercase letters and digits only (keeps + and # for C++ / C#). */
export function normaliseForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

/** Edit distance, stopping early once it's clearly over `max` - only small typos matter here. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/** A candidate split up ahead of time, for scoring it against many queries (see prepareCandidate). */
export interface PreparedCandidate {
  whole: string;
  words: string[];
}

export function prepareCandidate(candidate: string): PreparedCandidate {
  return {
    whole: normaliseForMatch(candidate),
    words: candidate.toLowerCase().split(/[\s/().-]+/).map(normaliseForMatch).filter(Boolean),
  };
}

/**
 * Lower is a better match; null means no match. `query` must already be normalised. Set `typos`
 * false for a cheap first pass over a large list - the typo check is by far the slowest part.
 */
export function scorePrepared(q: string, { whole, words }: PreparedCandidate, typos = true): number | null {
  if (!q || !whole) return null;
  if (whole === q) return 0;
  // A whole-name and a single-word prefix rank the same, so "exc" finds "Microsoft Excel"
  // before the rarer "Excel VBA" - ties then fall back to the caller's order.
  if (whole.startsWith(q) || words.some((word) => word.startsWith(q))) return 1;
  if (q.length >= 3 && whole.includes(q)) return 3;
  // Typo tolerance: compare against the start of the name (or a word in it) at about the same
  // length, so a half-typed misspelling ("snowflk") still finds the full name. The first letter
  // must match - typos there are rare, and it skips most of a long list.
  if (typos && q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    for (const text of [whole, ...words]) {
      if (text[0] !== q[0]) continue;
      // ±1 length so a dropped or doubled letter ("exel", "exxcel") doesn't cost a second edit.
      for (const d of [0, -1, 1]) {
        if (editDistance(q, text.slice(0, q.length + d), allowed) <= allowed) return 4;
      }
    }
  }
  return null;
}

/** scorePrepared for one-off strings. */
export function matchScore(query: string, candidate: string, typos = true): number | null {
  return scorePrepared(normaliseForMatch(query), prepareCandidate(candidate), typos);
}

/**
 * Best matches for what's been typed so far, from `pool` (most relevant first - e.g. the person's
 * own saved values, then a catalog), skipping anything in `exclude` (e.g. already chosen).
 * Case-insensitive duplicates collapse to the first spelling seen.
 */
export function suggestFromList(query: string, pool: readonly string[], exclude: readonly string[] = [], limit = 6): string[] {
  const q = normaliseForMatch(query);
  if (!q) return [];
  const excluded = new Set(exclude.map(normaliseForMatch));
  const seen = new Set<string>();
  const scored: { value: string; score: number; order: number }[] = [];
  pool.forEach((value, order) => {
    const key = normaliseForMatch(value);
    if (!key || seen.has(key) || excluded.has(key)) return;
    seen.add(key);
    const score = scorePrepared(q, prepareCandidate(value));
    if (score !== null) scored.push({ value, score, order });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.slice(0, limit).map((entry) => entry.value);
}
