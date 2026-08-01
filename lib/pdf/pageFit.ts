import "@/lib/pdf/domPolyfills";
import { PDFParse } from "pdf-parse";
import type { Browser } from "puppeteer-core";
import { createElement } from "react";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { applyTrim, buildTrimLadder } from "@/lib/pdf/trimLadder";
import type { ResumeContent, Template } from "@/types";

export { buildTrimLadder, applyTrim, type TrimState } from "@/lib/pdf/trimLadder";

// 1.3cm all round, the compact end of the 1.3-1.6cm target range for this layout.
const PAGE_MARGIN_MM = 13;

// One page is the target and the ladder tries hard to get there; two pages is the accepted
// ceiling for a genuinely long/dense career history, never three.
const PAGE_CEILING = 2;

function wrapResumeHtml(bodyMarkup: string): string {
  return `<!DOCTYPE html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }
      * { box-sizing: border-box; }
      body { margin: 0; }
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
 * Renders a resume to a page-fitted PDF. Starts at full density/content and walks the trim
 * ladder (see trimLadder.ts), re-rendering and re-measuring the page count via pdf-parse after
 * each step. One page is the goal and this returns immediately the first time a state achieves
 * it. If no state ever reaches one page, it falls back to the LEAST aggressive state that still
 * reached the two-page ceiling (remembered as we go, not searched for after the fact) rather than
 * the most aggressive state the ladder ever reaches - a resume that only needed light trimming to
 * hit two pages shouldn't end up at floor font/spacing just because one page was never possible.
 * Only if nothing ever got within the ceiling does it fall back to the ladder's final (most
 * aggressive) state as an absolute last resort. A resume that already fits at full density
 * returns on the first iteration untouched, no font/spacing is ever inflated, which is what keeps
 * short profiles at natural density instead of being padded out.
 */
export async function renderResumeToFittedPdf(
  browser: Browser,
  resume: ResumeContent,
  template: Template
): Promise<Buffer> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const definition = getTemplateDefinition(template);
  const ladder = buildTrimLadder(resume);

  const page = await browser.newPage();
  try {
    let lastPdf: Buffer | null = null;
    let bestWithinCeiling: Buffer | null = null;

    for (const state of ladder) {
      const trimmedResume = applyTrim(resume, state);
      const markup = renderToStaticMarkup(
        createElement(definition.component, { resume: trimmedResume, density: state.density })
      );
      await page.setContent(wrapResumeHtml(markup), { waitUntil: "load" });
      const pdf = Buffer.from(await page.pdf({ format: "a4", printBackground: true }));
      lastPdf = pdf;

      const pageCount = await countPdfPages(pdf);
      if (pageCount <= 1) return pdf;
      if (pageCount <= PAGE_CEILING && !bestWithinCeiling) {
        bestWithinCeiling = pdf;
      }
    }

    return bestWithinCeiling ?? (lastPdf as Buffer);
  } finally {
    await page.close();
  }
}
