import { STATES } from "@/lib/jobs/places";

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
