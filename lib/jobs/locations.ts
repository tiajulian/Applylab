import { stateCode, STATES } from "@/lib/jobs/places";

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

/**
 * Places typed as one comma-separated line, one per place: "Sydney, Melbourne" is two, while
 * "Richmond, VIC", "Parramatta, New South Wales" and "Kogarah, NSW 2217" are one each - a part
 * that is only a state and/or a postcode belongs to the place before it. The exception is a known
 * city followed by a different state ("Sydney, Victoria"): that's the city and the whole state.
 */
export function splitPlaceList(raw: string): string[] {
  const places: string[] = [];
  for (const part of raw.split(",")) {
    const text = part.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const rest = text.replace(/\b\d{4}\b/, "").trim();
    const code = rest ? stateCode(rest) : null;
    const previous = places[places.length - 1];
    const cityState = previous ? CITY_STATES[previous] : undefined;
    const qualifies = previous !== undefined && (rest === "" || (code !== null && (!cityState || cityState === code)));
    if (qualifies) places[places.length - 1] += `, ${text}`;
    else places.push(text);
  }
  return places;
}
