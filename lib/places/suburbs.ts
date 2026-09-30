// Suburb suggestions for location fields: every Australian locality from GeoNames (CC BY 4.0),
// built into public/data/au-suburbs.json by scripts/build-au-suburbs.mjs. Loaded once, on first
// use, and matched in the browser - no API call per keystroke.
import { placeReadings, stateFromPostcode } from "@/lib/jobs/places";
import {
  normaliseForMatch,
  prepareCandidate,
  preparedFor,
  scorePrepared,
  TYPO_MIN_LENGTH,
  TYPO_SCORE,
  type PreparedCandidate,
} from "@/lib/text/fuzzyMatch";

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

const byRelevance = (a: Scored, b: Scored) =>
  a.score - b.score || a.rank - b.rank || (a.suggestion.value < b.suggestion.value ? -1 : a.suggestion.value > b.suggestion.value ? 1 : 0);

/**
 * Best places for what's been typed: "kog", "kograh" (typo), "richmond vic", "2217". `extras`
 * (e.g. cities and states for Job Matcher) are offered as-is and win ties. A suburb that is the
 * same place as an extra (same name and, per `extraStates`, same state) is left out of name
 * searches so "Sydney" isn't listed twice - "Perth, TAS" still shows, and a postcode search
 * ("2000") still finds "Sydney, NSW". `exclude` skips values already chosen.
 */
export function suggestPlaces(
  query: string,
  suburbs: readonly Suburb[],
  {
    extras = [],
    extraStates = {},
    exclude = [],
    limit = 6,
  }: {
    extras?: readonly string[];
    extraStates?: Readonly<Record<string, string>>;
    exclude?: readonly string[];
    limit?: number;
  } = {}
): PlaceSuggestion[] {
  const fullPostcode = query.match(/\b\d{4}\b/)?.[0];
  // Plus the whole text as a name: placeReadings reads "vic" or "victoria" as just a state, which
  // would hide "Victoria Park" and the state itself while it's being typed. It keeps a postcode's
  // state, so "Richmond 3121" still means the Richmond in VIC.
  const readings = [
    { name: query.replace(/\d+/g, " ").trim(), state: fullPostcode ? stateFromPostcode(Number(fullPostcode)) : null },
    ...placeReadings(query),
  ];
  const hasName = readings.some((r) => r.name);
  // A bare postcode ("2217", or "221" on the way there) matches by postcode instead of name.
  const postcode = hasName ? null : query.match(/\d{3,4}/)?.[0];
  if (!hasName && !postcode) return [];

  const excluded = new Set(exclude.map((v) => v.toLowerCase()));
  // "sydney|NSW" for each extra with a known state.
  const extraPlaces = new Set(extras.filter((v) => extraStates[v]).map((v) => `${v.toLowerCase()}|${extraStates[v]}`));

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

  // Only the best `limit` are kept as we go - a short query matches thousands of suburbs, and
  // sorting them all on every keystroke just to show six is wasted work.
  const best: Scored[] = [];
  let found = 0;
  function offer(entry: Scored) {
    found++;
    if (best.length === limit && byRelevance(entry, best[limit - 1]) >= 0) return;
    let i = best.length;
    while (i > 0 && byRelevance(entry, best[i - 1]) < 0) i--;
    best.splice(i, 0, entry);
    if (best.length > limit) best.pop();
  }

  /** `typosOnly`: the second pass, which adds only typo matches - everything else was offered in the first. */
  function collect(typosOnly: boolean) {
    const keep = (s: number | null): s is number => s !== null && (!typosOnly || s === TYPO_SCORE);
    extras.forEach((extra, i) => {
      if (excluded.has(extra.toLowerCase())) return;
      const s = score(preparedFor(extra), null, typosOnly);
      if (keep(s)) offer({ suggestion: { value: extra }, score: s, rank: i - extras.length });
    });
    suburbs.forEach(([name, state, code], i) => {
      const s = postcode ? (code.startsWith(postcode) ? 1 : null) : score(names[i], state, typosOnly);
      if (!keep(s)) return;
      const value = `${name}, ${state}`;
      if ((!postcode && extraPlaces.has(`${name.toLowerCase()}|${state}`)) || excluded.has(value.toLowerCase())) return;
      offer({ suggestion: { value, detail: code }, score: s, rank: name.length });
    });
  }

  collect(false);
  // Typo matching over ~17k names is the slow part: only when plain matches come up short, and
  // only for a query long enough to have typos matched at all.
  if (found < limit && queries.some(({ q }) => q.length >= TYPO_MIN_LENGTH)) collect(true);
  return best.map((s) => s.suggestion);
}
