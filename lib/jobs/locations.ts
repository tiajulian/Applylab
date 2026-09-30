import { stateCode, STATES, trailingStateCode } from "@/lib/jobs/places";

/**
 * The main cities and their states. The state lets a suburb suggestion that repeats a city
 * ("Sydney, NSW") be dropped without also hiding a same-named town elsewhere ("Perth, TAS").
 */
export const CITY_STATES: Readonly<Record<string, string>> = {
  Sydney: "NSW",
  Melbourne: "VIC",
  Brisbane: "QLD",
  Perth: "WA",
  Adelaide: "SA",
  Canberra: "ACT",
  Hobart: "TAS",
  Darwin: "NT",
  "Gold Coast": "QLD",
  Newcastle: "NSW",
  "Sunshine Coast": "QLD",
  Wollongong: "NSW",
  Geelong: "VIC",
  Townsville: "QLD",
  Cairns: "QLD",
  Toowoomba: "QLD",
  Ballarat: "VIC",
  Bendigo: "VIC",
  Launceston: "TAS",
};

// Location suggestions for the job profile: the cities, then the full state names. Names match
// Adzuna's location.area values, which is what the matching SQL compares against.
export const AU_LOCATIONS: readonly string[] = [...Object.keys(CITY_STATES), ...Object.values(STATES)];

// Lowercase city name -> state, for text typed in any case.
const CITY_STATE_BY_NAME = new Map(Object.entries(CITY_STATES).map(([city, state]) => [city.toLowerCase(), state]));

/**
 * Places typed as one comma-separated line, one per place. A part that is only a state (code or
 * name) and/or a postcode qualifies the place before it - "Richmond, VIC", "Parramatta, New South
 * Wales", "Kogarah, NSW 2217", "Mount Victoria, NSW" are one place each - unless that place is
 * itself a state, already has a state, or is a known city in another state: "NSW, VIC", "Richmond,
 * VIC, NSW", "Sydney, VIC" and "Sydney, Victoria" are two places each.
 */
export function splitPlaceList(raw: string): string[] {
  const places: string[] = [];
  // Whether each place already has a state: one attached here, or a trailing state code typed with
  // it ("Richmond VIC") - not just a name ending in a state word ("Mount Victoria").
  const hasState: boolean[] = [];
  for (const part of raw.split(",")) {
    const text = part.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const rest = text.replace(/\b\d{4}\b/, "").trim();
    const code = rest ? stateCode(rest) : null;
    const last = places.length - 1;
    const previous = places[last];
    const cityState = previous ? CITY_STATE_BY_NAME.get(previous.toLowerCase()) : undefined;
    const qualifies =
      previous !== undefined &&
      stateCode(previous) === null &&
      (rest === "" || (code !== null && !hasState[last] && (!cityState || cityState === code)));
    if (qualifies) {
      places[last] += `, ${text}`;
      hasState[last] ||= code !== null;
    } else {
      places.push(text);
      hasState.push(trailingStateCode(text) !== null);
    }
  }
  return places;
}
