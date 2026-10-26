import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "puppeteer-core";
import { pdfFontFaceCss, servePdfFonts, waitForPdfFonts } from "./pdfFonts";

// Real Puppeteer check that the bundled substitute fonts are served and embedded. A dev machine has
// the real system fonts, which local() would pick instead, so this drops local() and renames the
// families to simulate the serverless Chromium on Vercel, where only the bundled files can match.

let browser: Browser;

beforeAll(async () => {
  const puppeteer = await import("puppeteer");
  browser = (await puppeteer.launch({ headless: true })) as unknown as Browser;
  // Generous: the full suite runs many files in parallel, which slows the browser's start.
}, 90_000);

afterAll(async () => {
  await browser?.close();
}, 90_000);

async function embeddedFonts(css: string, body: string): Promise<string[]> {
  const page = await browser.newPage();
  try {
    await servePdfFonts(page);
    await page.setContent(`<html><head><style>${css}</style></head><body>${body}</body></html>`, { waitUntil: "load" });
    await waitForPdfFonts(page);
    const pdf = Buffer.from(await page.pdf({ format: "a4" })).toString("latin1");
    return Array.from(new Set(pdf.match(/\/BaseFont\s*\/[A-Za-z+-]+/g) ?? []));
  } finally {
    await page.close();
  }
}

describe("PDF substitute fonts", () => {
  it("serves and embeds the bundled file for each picked font, with no system font to fall back on", async () => {
    const css = pdfFontFaceCss("Garamond Verdana Arial")
      .replace(/local\("[^"]+"\), /g, "")
      .replace(/font-family: "(\w+)"/g, 'font-family: "Bundled$1"');
    const fonts = await embeddedFonts(
      css,
      `<p style="font-family: BundledGaramond">Garamond <b>bold</b> <i>italic</i></p>
       <p style="font-family: BundledVerdana">Verdana</p>
       <p style="font-family: BundledArial">Arial</p>`
    );

    expect(fonts.some((f) => /EBGaramond/i.test(f))).toBe(true);
    expect(fonts.some((f) => /DejaVuSans/i.test(f))).toBe(true);
    expect(fonts.some((f) => /Arimo/i.test(f))).toBe(true);
  }, 60_000);

  it("only declares faces for font names the markup uses", () => {
    const css = pdfFontFaceCss(`<p style="font-family: Georgia, serif">x</p>`);
    expect(css).toContain('font-family: "Georgia"');
    expect(css).not.toContain('font-family: "Garamond"');
  });
});
