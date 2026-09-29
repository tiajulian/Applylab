// Loads Australian localities with coordinates into public.au_places for Job Matcher's distance
// search. Source: GeoNames postal codes (https://www.geonames.org, CC BY 4.0 - credited in the UI).
// Safe to re-run: rows are upserted by (name_key, state).
//
//   node scripts/load-au-places.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from the environment or .env.local).

import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local - rely on the real environment.
}

const SOURCE = "https://download.geonames.org/export/zip/AU.zip";
const BATCH = 1000;

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`GeoNames download failed: HTTP ${response.status}`);
const zip = await JSZip.loadAsync(await response.arrayBuffer());
const text = await zip.file("AU.txt").async("string");

// One place name can have several postcodes; average them into one point per name + state.
const places = new Map();
for (const line of text.split("\n")) {
  const [, , name, state, stateCode, , , , , lat, lng] = line.split("\t");
  if (!name || !state || !Number(lat) || !Number(lng)) continue;
  const key = `${name.toLowerCase()}|${state}`;
  const place = places.get(key) ?? { name_key: name.toLowerCase(), name, state, state_code: stateCode, lat: 0, lng: 0, n: 0 };
  place.lat += Number(lat);
  place.lng += Number(lng);
  place.n += 1;
  places.set(key, place);
}

const rows = [...places.values()].map(({ n, lat, lng, ...place }) => ({
  ...place,
  lat: Math.round((lat / n) * 1e4) / 1e4,
  lng: Math.round((lng / n) * 1e4) / 1e4,
}));

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from("au_places").upsert(rows.slice(i, i + BATCH), { onConflict: "name_key,state" });
  if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
}
console.log(`Loaded ${rows.length} places into au_places.`);
