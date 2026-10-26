import puppeteer from "puppeteer";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Renders the home page template thumbnails (public/templates/*.webp) from the REAL resume
 * templates, via the dev-only page app/dev/template-thumbnail/[id]. Hand-drawn mockups drifted
 * from the templates (bands and sidebars the real ones don't have), so thumbnails now come only
 * from the templates themselves.
 *
 * Usage: start the dev server (npm run dev), then: node scripts/render-templates.mjs
 * BASE_URL overrides the default http://localhost:3000.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../public/templates");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const TEMPLATE_IDS = ["clean", "classic", "modern", "compact", "editorial", "technical", "executive", "minimal"];

// A4 at 96dpi.
const A4 = { width: 794, height: 1123 };

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--font-render-hinting=none"] });

  try {
    for (const id of TEMPLATE_IDS) {
      const page = await browser.newPage();
      await page.setViewport({ ...A4, deviceScaleFactor: 2 });
      const response = await page.goto(`${BASE_URL}/dev/template-thumbnail/${id}`, {
        // "load", not networkidle: the dev server's HMR socket never goes idle. The first visit
        // also compiles the route, hence the long timeout.
        waitUntil: "load",
        timeout: 180_000,
      });
      if (!response?.ok()) throw new Error(`${id}: page returned ${response?.status()}`);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      const sheet = await page.$("[data-thumbnail]");
      if (!sheet) throw new Error(`${id}: no [data-thumbnail] element`);
      const screenshot = await sheet.screenshot({ type: "png" });
      await page.close();

      const out1x = await sharp(screenshot).resize(600, 849, { fit: "cover", position: "top" }).webp({ quality: 82, effort: 6 }).toBuffer();
      const out2x = await sharp(screenshot).resize(1200, 1697, { fit: "cover", position: "top" }).webp({ quality: 80, effort: 6 }).toBuffer();
      await fs.writeFile(path.join(OUTPUT_DIR, `${id}.webp`), out1x);
      await fs.writeFile(path.join(OUTPUT_DIR, `${id}@2x.webp`), out2x);
      console.log(`${id}: ${(out1x.length / 1024).toFixed(1)} KB / ${(out2x.length / 1024).toFixed(1)} KB`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Error rendering templates:", err);
  process.exit(1);
});
