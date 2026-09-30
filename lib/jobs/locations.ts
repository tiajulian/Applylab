import { placeReadings, stateCode, STATES } from "@/lib/jobs/places";

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
 * Wales", "Kogarah, NSW 2217" are one place each - unless that place is itself a state, already
 * has a state, or is a known city in another state: "NSW, VIC", "Richmond, VIC, NSW", "Sydney,
 * VIC" and "Sydney, Victoria" are two places each.
 */
export function splitPlaceList(raw: string): string[] {
  const places: string[] = [];
  for (const part of raw.split(",")) {
    const text = part.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const rest = text.replace(/\b\d{4}\b/, "").trim();
    const code = rest ? stateCode(rest) : null;
    const previous = places[places.length - 1];
    const cityState = previous ? CITY_STATE_BY_NAME.get(previous.toLowerCase()) : undefined;
    const qualifies =
      previous !== undefined &&
      stateCode(previous) === null &&
      (rest === "" ||
        (code !== null && (!cityState || cityState === code) && !placeReadings(previous).some((r) => r.state)));
    if (qualifies) places[places.length - 1] += `, ${text}`;
    else places.push(text);
  }
  return places;
}
