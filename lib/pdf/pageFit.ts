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
 * Renders a resume to a single-page-fitted PDF. Starts at full density/content and walks the trim
 * ladder (see trimLadder.ts) only as far as needed, re-rendering and re-measuring the page count
 * via pdf-parse after each step, stopping at the first state that fits (or the last state in the
 * ladder if every floor is exhausted and it still doesn't fit). A resume that already fits at full
 * density returns on the first iteration untouched, no font/spacing is ever inflated, which is what
 * keeps short profiles at natural density instead of being padded out.
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
    for (let i = 0; i < ladder.length; i++) {
      const state = ladder[i];
      const trimmedResume = applyTrim(resume, state);
      const markup = renderToStaticMarkup(
        createElement(definition.component, { resume: trimmedResume, density: state.density })
      );
      await page.setContent(wrapResumeHtml(markup), { waitUntil: "load" });
      const pdf = Buffer.from(await page.pdf({ format: "a4", printBackground: true }));
      lastPdf = pdf;

      const isLastStep = i === ladder.length - 1;
      if (isLastStep) return pdf;

      const pageCount = await countPdfPages(pdf);
      if (pageCount <= 1) return pdf;
    }
    return lastPdf as Buffer;
  } finally {
    await page.close();
  }
}
