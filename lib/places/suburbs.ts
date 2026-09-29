// Suburb suggestions for location fields: every Australian locality from GeoNames (CC BY 4.0),
// built into public/data/au-suburbs.json by scripts/build-au-suburbs.mjs. Loaded once, on first
// use, and matched in the browser - no API call per keystroke.
import { placeReadings } from "@/lib/jobs/places";
import { normaliseForMatch, prepareCandidate, scorePrepared, type PreparedCandidate } from "@/lib/text/fuzzyMatch";

/** [name, state code, postcode] */
export type Suburb = readonly [string, string, string];

export interface PlaceSuggestion {
  /** What goes in the field: "Kogarah, NSW", or an extra as given ("Sydney"). */
  value: string;
  /** Shown beside it to tell same-named places apart: the postcode. */
  detail?: string;
}

let suburbsPromise: Promise<Suburb[]> | null = null;

/** The suburb list, fetched once per page load; a failed fetch can be retried on the next call. */
export function loadSuburbs(): Promise<Suburb[]> {
  suburbsPromise ??= fetch("/data/au-suburbs.json")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Suburb[]>;
    })
    .catch((error) => {
      suburbsPromise = null;
      throw error;
    });
  return suburbsPromise;
}

// Each list is split into match-ready names once, not on every keystroke.
const prepared = new WeakMap<readonly Suburb[], PreparedCandidate[]>();
function preparedNames(suburbs: readonly Suburb[]): PreparedCandidate[] {
  let names = prepared.get(suburbs);
  if (!names) {
    names = suburbs.map(([name]) => prepareCandidate(name));
    prepared.set(suburbs, names);
  }
  return names;
}

interface Scored {
  suggestion: PlaceSuggestion;
  score: number;
  /** Extras (cities, states) first on a tie, then shorter names. */
  rank: number;
}

/**
 * Best places for what's been typed: "kog", "kograh" (typo), "richmond vic", "2217". `extras`
 * (e.g. cities and states for Job Matcher) are offered as-is and win ties; a suburb with the same
 * name as an extra is left out so "Sydney" isn't listed twice. `exclude` skips values already chosen.
 */
export function suggestPlaces(
  query: string,
  suburbs: readonly Suburb[],
  { extras = [], exclude = [], limit = 6 }: { extras?: readonly string[]; exclude?: readonly string[]; limit?: number } = {}
): PlaceSuggestion[] {
  // Plus the whole text as a name: placeReadings reads "vic" or "victoria" as just a state, which
  // would hide "Victoria Park" and the state itself while it's being typed.
  const readings = [{ name: query.replace(/\d+/g, " ").trim(), state: null }, ...placeReadings(query)];
  const hasName = readings.some((r) => r.name);
  // A bare postcode ("2217", or "221" on the way there) matches by postcode instead of name.
  const postcode = hasName ? null : query.match(/\d{3,4}/)?.[0];
  if (!hasName && !postcode) return [];

  const excluded = new Set(exclude.map((v) => v.toLowerCase()));
  const extraNames = new Set(extras.map((v) => v.toLowerCase()));

  // Readings often coincide ("kog" read whole and as a name) - score each distinct one once.
  const queries = [
    ...new Map(
      readings.filter((r) => r.name).map((r) => [`${normaliseForMatch(r.name)}|${r.state}`, { q: normaliseForMatch(r.name), state: r.state }])
    ).values(),
  ];
  const names = preparedNames(suburbs);

  function score(name: PreparedCandidate, state: string | null, typos: boolean): number | null {
    let best: number | null = null;
    for (const { q, state: wanted } of queries) {
      if (wanted && state && wanted !== state) continue;
      const s = scorePrepared(q, name, typos);
      if (s !== null && (best === null || s < best)) best = s;
    }
    return best;
  }

  function collect(typos: boolean): Scored[] {
    const out: Scored[] = [];
    extras.forEach((extra, i) => {
      if (excluded.has(extra.toLowerCase())) return;
      const s = score(prepareCandidate(extra), null, typos);
      if (s !== null) out.push({ suggestion: { value: extra }, score: s, rank: i - extras.length });
    });
    suburbs.forEach(([name, state, code], i) => {
      const s = postcode ? (code.startsWith(postcode) ? 1 : null) : score(names[i], state, typos);
      if (s === null) return;
      const value = `${name}, ${state}`;
      if (extraNames.has(name.toLowerCase()) || excluded.has(value.toLowerCase())) return;
      out.push({ suggestion: { value, detail: code }, score: s, rank: name.length });
    });
    return out;
  }

  // Typo matching over ~17k names is the slow part, so only fall back to it when the plain
  // prefix pass comes up short.
  let scored = collect(false);
  if (hasName && scored.length < limit) scored = collect(true);
  return scored
    .sort((a, b) => a.score - b.score || a.rank - b.rank || a.suggestion.value.localeCompare(b.suggestion.value))
    .slice(0, limit)
    .map((s) => s.suggestion);
}
