// Builds public/data/au-suburbs.json - every Australian locality as [name, state code, postcode] -
// for the suburb suggestions in location fields. Same source as load-au-places.mjs: GeoNames postal
// codes (https://www.geonames.org, CC BY 4.0 - credited in the UI). Re-run to refresh.
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
const NOT_A_SUBURB = /^(?:02|1|5[89]|6[89]|7[89]|8|9)/;

// One place can have several postcodes; keep the lowest (usually its delivery postcode).
const places = new Map();
for (const line of text.split("\n")) {
  const [, postcode, name, , stateCode] = line.split("\t");
  if (!name || !stateCode || !/^\d{4}$/.test(postcode ?? "") || NOT_A_SUBURB.test(postcode)) continue;
  const key = `${name.toLowerCase()}|${stateCode}`;
  const existing = places.get(key);
  if (!existing || postcode < existing[2]) places.set(key, [name, stateCode, postcode]);
}

const rows = [...places.values()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
await writeFile("public/data/au-suburbs.json", JSON.stringify(rows));
console.log(`Wrote ${rows.length} places to public/data/au-suburbs.json.`);
