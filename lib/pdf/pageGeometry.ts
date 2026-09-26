// The true CSS pixel dimensions Chromium's page.pdf() renders an A4 page at - 96 CSS px per inch
// is a fixed CSS spec constant Chromium's print layout always uses for a page's content box,
// regardless of host display DPI. Anything that needs the exported PDF's actual line-wrapping and
// page-break behaviour (not just a compact on-screen editing view - see ResumePreviewPane's own,
// deliberately smaller SHEET_WIDTH/PAGE_HEIGHT, hand-tuned for the always-visible editing canvas)
// must measure/render at these dimensions, not the editing canvas's.
//
// Regression: ResumePreviewModal used to measure its trim-ladder page count at the editing
// canvas's 560px width. At the same absolute font-size (pt units, unaffected by container width),
// a 560px-wide box wraps text far more aggressively than a real ~695px-wide A4 content box does,
// so the popup measured MORE pages than the real PDF ever would and over-trimmed content (dropped
// bullets/the referee line) the actual export never needed to drop. Confirmed with a real
// Puppeteer-rendered PDF: an untrimmed resume that fits the real PDF in 1 page measured as
// needing 2+ pages at 560px width, triggering trim-ladder steps the true export never reaches.
const PX_PER_MM = 96 / 25.4;
export const A4_WIDTH_PX = Math.round(210 * PX_PER_MM);
export const A4_HEIGHT_PX = Math.round(297 * PX_PER_MM);

/** A real PDF's `@page { margin: Xmm }` applies the same margin on all four sides - unlike
 * ResumePreviewPane's canvas padding (deliberately asymmetric, hand-tuned for the compact editing
 * view, never a physical mm conversion), this must stay a single equal value to match. */
export function marginMmToPx(marginMm: number): number {
  return marginMm * PX_PER_MM;
}
