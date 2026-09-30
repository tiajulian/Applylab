// Forgiving "as you type" matching for suggestion dropdowns (tools, places): prefixes of the name
// or of any word in it, then small typos, so a half-typed or misspelled name still finds its match.

/** Lowercase letters and digits only (keeps + and # for C++ / C#). */
export function normaliseForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

// Reused rows for editDistance - it runs for thousands of names per keystroke, so no allocations.
let prevRow = new Int32Array(64);
let currRow = new Int32Array(64);

/**
 * Edit distance between `a` and the first `bLength` characters of `b`, stopping early once it's
 * clearly over `max` - only small typos matter here.
 */
function editDistance(a: string, b: string, bLength: number, max: number): number {
  if (Math.abs(a.length - bLength) > max) return max + 1;
  if (prevRow.length <= bLength) {
    prevRow = new Int32Array(bLength + 1);
    currRow = new Int32Array(bLength + 1);
  }
  let prev = prevRow;
  let curr = currRow;
  for (let j = 0; j <= bLength; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLength; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[bLength];
}

/** The score of a typo-only match (worse than any prefix or substring match). */
export const TYPO_SCORE = 4;
/** Queries shorter than this are never typo-matched - too many names are one edit away. */
export const TYPO_MIN_LENGTH = 4;

// +1 before -1: when the text is no longer than the query, 0 and +1 clamp to the same length and
// are then adjacent, so the repeat is skipped.
const TYPO_LENGTH_OFFSETS = [0, 1, -1];

/**
 * Whether `text` starts with `q` give or take `allowed` edits. Compares against the start of `text`
 * at q's length ±1, so a dropped or doubled letter ("exel", "exxcel") doesn't cost a second edit;
 * a text shorter than that is compared once, not once per length. The first letter must match -
 * typos there are rare, and it skips most of a long list cheaply.
 */
function typoMatch(q: string, text: string, allowed: number): boolean {
  if (text.charCodeAt(0) !== q.charCodeAt(0)) return false;
  let tried = -1;
  for (const d of TYPO_LENGTH_OFFSETS) {
    const length = Math.min(text.length, q.length + d);
    if (length === tried) continue;
    tried = length;
    if (editDistance(q, text, length, allowed) <= allowed) return true;
  }
  return false;
}

/** A candidate (or a query) split up ahead of time, for scoring many pairs (see prepareCandidate). */
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

/** Edits a word of this length may contain and still match: none for short words. */
const typosAllowed = (length: number) => (length >= 7 ? 2 : length >= TYPO_MIN_LENGTH ? 1 : 0);

/**
 * Whether the query's words line up with consecutive words of the candidate, each within its own
 * typo allowance: whole words for all but the last, which is still being typed (so a prefix, or
 * a typo'd prefix). Per word, so the allowance can't be spent across words - "bachelor of com"
 * must not reach "Bachelor of Social Work".
 */
function wordsTypoMatch(queryWords: string[], words: string[]): boolean {
  const lastIndex = queryWords.length - 1;
  for (let start = 0; start + queryWords.length <= words.length; start++) {
    const aligned = queryWords.every((qw, k) => {
      const word = words[start + k];
      const allowed = typosAllowed(qw.length);
      if (k === lastIndex) return word.startsWith(qw) || (allowed > 0 && typoMatch(qw, word, allowed));
      return word === qw || (allowed > 0 && editDistance(qw, word, word.length, allowed) <= allowed);
    });
    if (aligned) return true;
  }
  return false;
}

/**
 * Lower is a better match; null means no match. Pass the query through prepareCandidate too. Set
 * `typos` false for a cheap first pass over a large list - the typo check is by far the slowest part.
 */
export function scorePrepared(query: PreparedCandidate, { whole, words }: PreparedCandidate, typos = true): number | null {
  const q = query.whole;
  if (!q || !whole) return null;
  if (whole === q) return 0;
  // A whole-name and a single-word prefix rank the same, so "exc" finds "Microsoft Excel"
  // before the rarer "Excel VBA" - ties then fall back to the caller's order.
  if (whole.startsWith(q) || words.some((word) => word.startsWith(q))) return 1;
  if (q.length >= 3 && whole.includes(q)) return 3;
  // Typo tolerance, so a half-typed misspelling ("snowflk") still finds the full name.
  if (typos && q.length >= TYPO_MIN_LENGTH) {
    if (query.words.length > 1) return wordsTypoMatch(query.words, words) ? TYPO_SCORE : null;
    const allowed = typosAllowed(q.length);
    if (typoMatch(q, whole, allowed)) return TYPO_SCORE;
    // A one-word name is its own only word - already checked as `whole`.
    if (words.length > 1 || words[0] !== whole) {
      for (const word of words) if (typoMatch(q, word, allowed)) return TYPO_SCORE;
    }
  }
  return null;
}

// Catalog entries are prepared once and reused on every keystroke. Bounded by the catalogs plus
// the person's own values; the ~17k suburbs keep their own prepared list (see lib/places/suburbs).
const preparedCache = new Map<string, PreparedCandidate>();

/** prepareCandidate, cached - for the small lists (catalogs, extras) scored on every keystroke. */
export function preparedFor(value: string): PreparedCandidate {
  let prepared = preparedCache.get(value);
  if (!prepared) {
    prepared = prepareCandidate(value);
    preparedCache.set(value, prepared);
  }
  return prepared;
}

/**
 * Best matches for what's been typed so far, from `pool` (most relevant first - e.g. the person's
 * own saved values, then a catalog), skipping anything in `exclude` (e.g. already chosen).
 * Case-insensitive duplicates collapse to the first spelling seen. Typo matching only runs when
 * plain prefix/substring matches don't fill the list.
 */
export function suggestFromList(query: string, pool: readonly string[], exclude: readonly string[] = [], limit = 6): string[] {
  const q = prepareCandidate(query);
  if (!q.whole) return [];
  const excluded = new Set(exclude.map(normaliseForMatch));

  function collect(typos: boolean) {
    const seen = new Set<string>();
    const scored: { value: string; score: number; order: number }[] = [];
    pool.forEach((value, order) => {
      const prepared = preparedFor(value);
      if (!prepared.whole || seen.has(prepared.whole) || excluded.has(prepared.whole)) return;
      seen.add(prepared.whole);
      const score = scorePrepared(q, prepared, typos);
      if (score !== null) scored.push({ value, score, order });
    });
    return scored;
  }

  let scored = collect(false);
  if (scored.length < limit && q.whole.length >= TYPO_MIN_LENGTH) scored = collect(true);
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.slice(0, limit).map((entry) => entry.value);
}

/** suggestFromList as dropdown options. */
export function suggestionsFromList(
  query: string,
  pool: readonly string[],
  exclude: readonly string[] = []
): { value: string }[] {
  return suggestFromList(query, pool, exclude).map((value) => ({ value }));
}
