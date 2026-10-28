import "@/lib/pdf/domPolyfills";
import { PDFParse } from "pdf-parse";
import type { Browser } from "puppeteer-core";
import { renderResumeMarkup } from "@/lib/pdf/renderResumeMarkup";
import { buildTrimLadder } from "@/lib/pdf/trimLadder";
import { pdfFontFaceCss, servePdfFonts, waitForPdfFonts } from "@/lib/pdf/pdfFonts";
import {
  DEFAULT_DESIGN_PREFS,
  fontChoiceById,
  lineHeightCeilingFor,
  marginMmFor,
  spacingStartScaleFor,
  type ResumeDesignPrefs,
} from "@/lib/resume/designPrefs";
import type { ResumeContent, Template } from "@/types";

export { buildTrimLadder, type TrimState } from "@/lib/pdf/trimLadder";

function wrapResumeHtml(bodyMarkup: string, marginMm: number): string {
  return `<!DOCTYPE html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: ${marginMm}mm; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      ${pdfFontFaceCss(bodyMarkup)}
    </style>
  </head>
  <body>${bodyMarkup}</body>
</html>`;
}

async function countPdfPages(pdfBuffer: Buffer): Promise<number> {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const result = await parser.getText();
    return result.total;
  } finally {
    await parser.destroy();
  }
}

/**
 * Renders a resume to a page-fitted PDF. Starts at full density and walks the trim
 * ladder (see trimLadder.ts), re-rendering and re-measuring the page count via pdf-parse after
 * each step. One page is the goal and this returns immediately the first time a state achieves
 * it. If no state ever reaches one page, it returns the LEAST aggressive state with the fewest
 * pages rather than the most aggressive state the ladder reaches - a resume that only needed
 * light tightening to hit two pages shouldn't end up at floor font/spacing just because one page
 * was never possible, and since content is never cut, a long resume no step shortens keeps the
 * user's own layout. A resume that already fits at full density
 * returns on the first iteration untouched, no font/spacing is ever inflated, which is what keeps
 * short profiles at natural density instead of being padded out.
 */
export async function renderResumeToFittedPdf(
  browser: Browser,
  resume: ResumeContent,
  template: Template,
  baseFontPt?: number,
  accentColor?: string | null,
  designPrefs: ResumeDesignPrefs = DEFAULT_DESIGN_PREFS
): Promise<Buffer> {
  const marginMm = marginMmFor(designPrefs);
  const fontOverride = fontChoiceById(designPrefs.fontChoice)?.fontFamily;
  const lineHeightCeiling = lineHeightCeilingFor(designPrefs);
  const ladder = buildTrimLadder(baseFontPt, spacingStartScaleFor(designPrefs));

  const page = await browser.newPage();
  try {
    await servePdfFonts(page);
    // Same rule as lib/resume/fitToPdf.ts's pickFittedLadderIndex: the least aggressive state with
    // the fewest pages, stopping early once one fits a single page.
    let best: { pdf: Buffer; pageCount: number } | null = null;

    for (const state of ladder) {
      const markup = await renderResumeMarkup(resume, template, state.density, accentColor, fontOverride, lineHeightCeiling);
      await page.setContent(wrapResumeHtml(markup, marginMm), { waitUntil: "load" });
      await waitForPdfFonts(page);
      const pdf = Buffer.from(await page.pdf({ format: "a4", printBackground: true }));

      const pageCount = await countPdfPages(pdf);
      if (pageCount <= 1) return pdf;
      if (!best || pageCount < best.pageCount) best = { pdf, pageCount };
    }

    return best!.pdf;
  } finally {
    await page.close();
  }
}

