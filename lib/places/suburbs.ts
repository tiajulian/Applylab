// Suburb suggestions for location fields: every Australian locality from GeoNames (CC BY 4.0),
// built into public/data/au-suburbs.json by scripts/build-au-suburbs.mjs. Loaded once, on first
// use, and matched in the browser - no API call per keystroke.
import { placeReadings, STATES } from "@/lib/jobs/places";
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
  /** The place's name alone ("Kogarah"), for callers that match on names without a state. */
  name: string;
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

// The typo pass only runs when plain matches come up this short - even if the caller asked for
// more results (to collapse duplicates, say), a full list of plain matches needs no typo help.
const TYPO_BELOW = 6;

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
  // Plus the whole text as a name: placeReadings reads "vic" or "victoria" as just a state, which
  // would hide "Victoria Park" and the state itself while it's being typed. Not with digits: then
  // it's a postcode search ("2217 nsw") or a name narrowed by one ("Richmond 3121").
  const readings = /\d/.test(query)
    ? placeReadings(query)
    : [{ name: query.trim(), state: null }, ...placeReadings(query)];
  const hasName = readings.some((r) => r.name);
  // A bare postcode ("2217", or "221" on the way there) matches by postcode instead of name.
  const postcode = hasName ? null : query.match(/\d{3,4}/)?.[0];
  if (!hasName && !postcode) return [];

  // Chosen places by name, and by state when they have one: a place saved without a state
  // ("Kogarah") covers every suburb of that name, "Kogarah, NSW" just that one.
  const extraStateByName = new Map(Object.entries(extraStates).map(([extra, state]) => [extra.toLowerCase(), state]));
  const excluded = new Set<string>();
  for (const value of exclude) {
    // A chosen extra means that city ("Perth", or "perth" as typed, is Perth, WA) - not every Perth.
    const cityState = extraStateByName.get(value.toLowerCase());
    if (cityState) {
      excluded.add(`${normaliseForMatch(value)}|${cityState}`);
      continue;
    }
    // Every reading, so "Mount Victoria" (a town, or Mount in VIC) and "NSW" (New South Wales) are
    // both recognised.
    for (const { name, state } of placeReadings(value)) {
      // Punctuation-insensitive, like matching: "Brighton-Le-Sands" covers "Brighton Le Sands".
      if (name) excluded.add(state ? `${normaliseForMatch(name)}|${state}` : normaliseForMatch(name));
      else if (state) excluded.add(normaliseForMatch(STATES[state]));
    }
  }
  const isExcluded = (name: string, state: string | null) =>
    excluded.has(normaliseForMatch(name)) || (state !== null && excluded.has(`${normaliseForMatch(name)}|${state}`));
  // "sydney|NSW" for each extra with a known state.
  const extraPlaces = new Set(extras.filter((v) => extraStates[v]).map((v) => `${v.toLowerCase()}|${extraStates[v]}`));

  // Readings often coincide ("kog" read whole and as a name) - score each distinct one once.
  const distinct = [
    ...new Map(
      readings.filter((r) => r.name).map((r) => {
        const query = prepareCandidate(r.name);
        return [`${query.whole}|${r.state}`, { query, state: r.state }] as const;
      })
    ).values(),
  ];
  // Readings of the whole text come first; ones with a trailing state word stripped ("richmond" +
  // VIC for "richmond vic") only when the whole text matches nothing. Otherwise "mount victoria"
  // would also offer every "Mount ..." in VIC.
  const fullText = normaliseForMatch(query.replace(/\d+/g, " "));
  const whole = distinct.filter((r) => r.query.whole === fullText);
  const stripped = distinct.filter((r) => r.query.whole !== fullText);
  let queries = whole.length ? whole : stripped;
  const names = preparedNames(suburbs);

  function score(name: PreparedCandidate, state: string | null, typos: boolean): number | null {
    let best: number | null = null;
    for (const { query, state: wanted } of queries) {
      if (wanted && state && wanted !== state) continue;
      const s = scorePrepared(query, name, typos);
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
      if (extra === stateExtra || isExcluded(extra, extraStates[extra] ?? null)) return;
      // A city's own state, so "perth tas" doesn't offer the WA city.
      const s = score(preparedFor(extra), extraStates[extra] ?? null, typosOnly);
      if (keep(s)) offer({ suggestion: { value: extra, name: extra }, score: s, rank: i - extras.length });
    });
    suburbs.forEach(([name, state, code], i) => {
      const s = postcode ? (code.startsWith(postcode) ? 1 : null) : score(names[i], state, typosOnly);
      if (!keep(s)) return;
      const value = `${name}, ${state}`;
      if ((!postcode && extraPlaces.has(`${name.toLowerCase()}|${state}`)) || isExcluded(name, state)) return;
      offer({ suggestion: { value, detail: code, name }, score: s, rank: name.length });
    });
  }

  const typoable = () => queries.some(({ query }) => query.whole.length >= TYPO_MIN_LENGTH);

  // A state typed as its code or name ("wa", "NSW", "victoria") puts that state's extra first -
  // as a name, "wa" would only word-match "Wail" and the like.
  const typedState = postcode ? undefined : readings.find((r) => !r.name && r.state)?.state;
  const stateExtra = typedState ? extras.find((extra) => extra === STATES[typedState]) : undefined;
  if (stateExtra && !isExcluded(stateExtra, null)) {
    offer({ suggestion: { value: stateExtra, name: stateExtra }, score: -1, rank: -Infinity });
  }

  collect(false);
  if (found === 0 && queries === whole && stripped.length) {
    queries = stripped;
    collect(false);
  }
  // Typo matching over ~17k names is the slow part: only when plain matches come up short, and
  // only for a query long enough to have typos matched at all.
  if (found < Math.min(limit, TYPO_BELOW) && typoable()) collect(true);
  if (found === 0 && queries === stripped && whole.length) {
    queries = whole;
    if (typoable()) collect(true);
  }
  return best.map((s) => s.suggestion);
}
