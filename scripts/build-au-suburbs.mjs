// Builds public/data/au-suburbs.json - every Australian locality as [name, state code, postcodes] -
// for the suburb suggestions in location fields. `postcodes` is space-separated, ascending.
// Same source as load-au-places.mjs: GeoNames postal codes (https://www.geonames.org, CC BY 4.0 -
// credited in the UI). Re-run to refresh.
//
//   node scripts/build-au-suburbs.mjs

import { writeFile } from "node:fs/promises";
import JSZip from "jszip";

const SOURCE = "https://download.geonames.org/export/zip/AU.zip";

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`GeoNames download failed: HTTP ${response.status}`);
const zip = await JSZip.loadAsync(await response.arrayBuffer());
const text = await zip.file("AU.txt").async("string");

// PO box and large-volume-receiver ranges name mail centres, not suburbs.
const NOT_A_SUBURB = /^(?:02|09|1|5[89]|6[89]|7[89]|8|9)/;

// Business/delivery/mail centres, sorting centres, distribution facilities and post offices
// ("Perth Gpo", "Albion Dc", "Albury Msc") aren't places to live.
const MAIL_CENTRE = /\s(?:bc|dc|df|mc|msc|gpo|lpo)$|\s(?:mail|delivery|business) centre$/i;

// GeoNames title-cases every word: restore acronyms and "Mc" names so a picked suggestion is spelt
// properly on a profile or resume ("Hmas Cerberus" -> "HMAS Cerberus", "Mckinnon" -> "McKinnon").
const ACRONYMS = new Set(["HMAS", "RAAF", "UNSW", "RGH", "MP"]);
function fixCase(name) {
  return name
    .split(" ")
    .map((word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word.replace(/^Mc([a-z])/, (_, c) => `Mc${c.toUpperCase()}`)))
    .join(" ");
}

// One entry per name and state - the way the Job Matcher's au_places resolves a place - with all
// its postcodes. Same-named towns in one state (Ascot near Brisbane and near Toowoomba) can't be
// told apart reliably: GeoNames often gives them identical coordinates. Spellings that differ only
// in punctuation ("Brighton-Le-Sands" / "Brighton Le Sands", curly vs straight apostrophes) are one
// place too - keyed the way suggestions match names.
const places = new Map();
for (const line of text.split("\n")) {
  const [, postcode, rawName, , stateCode] = line.split("\t");
  const name = rawName && fixCase(rawName.replace(/[‘’]/g, "'"));
  if (!name || !stateCode || !/^\d{4}$/.test(postcode ?? "") || NOT_A_SUBURB.test(postcode) || MAIL_CENTRE.test(name)) continue;
  const key = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${stateCode}`;
  const place = places.get(key);
  if (place) place.postcodes.add(postcode);
  else places.set(key, { name, stateCode, postcodes: new Set([postcode]) });
}

// All of a place's postcodes, ascending: no rule in this data reliably tells a suburb's delivery
// postcode from its PO box ones (Sydney 2000/2001, Melbourne 3000/3001/3004), so none is picked.
const rows = [...places.values()]
  .map(({ name, stateCode, postcodes }) => [name, stateCode, [...postcodes].sort().join(" ")])
  .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
await writeFile("public/data/au-suburbs.json", JSON.stringify(rows));
console.log(`Wrote ${rows.length} places to public/data/au-suburbs.json.`);
