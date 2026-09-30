// Turns profile locations ("Kogarah", "Richmond VIC", "Parramatta, NSW 2150") into map points using
// public.au_places (GeoNames, CC BY 4.0), for Job Matcher's distance search.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export const STATES: Record<string, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

const STATE_BY_TEXT = new Map(Object.entries(STATES).flatMap(([code, name]) => [[code.toLowerCase(), code], [name.toLowerCase(), code]]));
// A state only counts at the end ("Victoria Park, WA"), never inside a place name ("Victoria Park").
const TRAILING_STATE = new RegExp(`(^|[\\s,]+)(${[...STATE_BY_TEXT.keys()].join("|")})\\s*$`, "i");

/**
 * Places typed as one comma-separated line, one per place: "Sydney, Melbourne" is two, but
 * "Richmond, VIC" and "Kogarah, NSW 2217" are one each - a part that is only a state code and/or
 * a postcode belongs to the place before it. A full state name is a place of its own
 * ("Sydney, Victoria" is Sydney and all of Victoria).
 */
export function splitPlaceList(raw: string): string[] {
  const places: string[] = [];
  for (const part of raw.split(",")) {
    const text = part.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const rest = text.replace(/\b\d{4}\b/, "").trim().toLowerCase();
    const qualifier = rest === "" || STATE_BY_TEXT.get(rest)?.toLowerCase() === rest;
    if (qualifier && places.length) places[places.length - 1] += `, ${text}`;
    else places.push(text);
  }
  return places;
}

/** Australian postcode -> state code (Australia Post ranges). */
export function stateFromPostcode(postcode: number): string | null {
  if ((postcode >= 200 && postcode <= 299) || (postcode >= 2600 && postcode <= 2618) || (postcode >= 2900 && postcode <= 2920)) return "ACT";
  if (postcode >= 800 && postcode <= 999) return "NT";
  const byFirstDigit: Record<string, string> = { "1": "NSW", "2": "NSW", "3": "VIC", "4": "QLD", "5": "SA", "6": "WA", "7": "TAS", "8": "VIC", "9": "QLD" };
  return postcode >= 1000 ? byFirstDigit[String(postcode)[0]] ?? null : null;
}

interface ParsedPlace {
  name: string;
  state: string | null;
}

/**
 * Readings of a free-text location, most likely first: a place name plus a state code (from a
 * trailing state name or a postcode). A bare state ("Victoria") has an empty name. A state word
 * after only a space is ambiguous - "Richmond VIC" is Richmond in VIC, but "Mount Victoria" is a
 * town - so the whole name is offered first; after a comma ("Victoria Park, WA") it is a state.
 */
export function placeReadings(raw: string): ParsedPlace[] {
  const postcode = raw.match(/\b\d{4}\b/)?.[0];
  const postcodeState = postcode ? stateFromPostcode(Number(postcode)) : null;
  const text = raw.replace(/\d+/g, " ").replace(/\s+/g, " ").trim().replace(/,$/, "").trim();
  const firstPart = (t: string) => t.split(",")[0].trim();

  const trailing = text.match(TRAILING_STATE);
  if (!trailing) return [{ name: firstPart(text), state: postcodeState }];

  const stripped = {
    name: firstPart(text.slice(0, trailing.index).trim()),
    state: STATE_BY_TEXT.get(trailing[2].toLowerCase()) ?? null,
  };
  const separatedBySpaceOnly = trailing[1] !== "" && !trailing[1].includes(",");
  return separatedBySpaceOnly ? [{ name: firstPart(text), state: postcodeState }, stripped] : [stripped];
}

/** The reading to use without an au_places check: the state reading when there is one. */
export function parsePlace(raw: string): ParsedPlace {
  const readings = placeReadings(raw);
  return readings[readings.length - 1];
}

function matching(rows: PlaceRow[], { name, state }: ParsedPlace): PlaceRow[] {
  return rows.filter((r) => name && r.name_key === name.toLowerCase() && (!state || r.state_code === state));
}

interface PlaceRow extends GeoPoint {
  name: string;
  name_key: string;
  state_code: string;
}

async function lookup(supabase: SupabaseClient, names: string[]): Promise<PlaceRow[]> {
  if (names.length === 0) return [];
  const { data, error } = await supabase
    .from("au_places")
    .select("name, name_key, state_code, lat, lng")
    .in("name_key", names.map((n) => n.toLowerCase()));
  if (error) throw error;
  return (data ?? []) as PlaceRow[];
}

/**
 * Map points for the locations, plus the ones that have none (states, unknown places) - those are
 * matched by name against the job's location instead. A name found in several states ("Richmond")
 * uses the state from the text or postcode, or all of them when there is neither.
 */
export async function resolvePoints(
  supabase: SupabaseClient,
  locations: string[]
): Promise<{ points: GeoPoint[]; unresolved: string[] }> {
  const readings = locations.map((raw) => ({ raw, options: placeReadings(raw) }));
  const rows = await lookup(supabase, readings.flatMap((r) => r.options.map((o) => o.name).filter(Boolean)));
  const points: GeoPoint[] = [];
  const unresolved: string[] = [];
  for (const { raw, options } of readings) {
    const found = options.map((option) => matching(rows, option)).find((m) => m.length) ?? [];
    if (found.length) {
      points.push(...found.map(({ lat, lng }) => ({ lat, lng })));
    } else {
      const { name, state } = options[options.length - 1];
      unresolved.push(!name && state ? STATES[state] : raw);
    }
  }
  return { points, unresolved };
}

/**
 * The known place a free-text location names, keeping its state when one was given
 * ("kogarah 2217" -> "Kogarah NSW", "Kogarah" -> "Kogarah"), or null.
 */
export async function findPlaceName(supabase: SupabaseClient, raw: string): Promise<string | null> {
  const options = placeReadings(raw);
  const rows = await lookup(supabase, options.map((o) => o.name).filter(Boolean));
  for (const option of options) {
    const match = matching(rows, option)[0];
    if (match) return option.state ? `${match.name} ${option.state}` : match.name;
  }
  return null;
}
