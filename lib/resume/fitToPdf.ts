// Mirrors lib/pdf/pageFit.ts's PAGE_CEILING (that module is server-only - puppeteer/pdf-parse -
// so it can't be imported client-side). One page is the goal, two the accepted ceiling.
export const PDF_PAGE_CEILING = 2;

/** Same selection rule as renderResumeToFittedPdf: the first trim-ladder state that fits one page
 * wins; otherwise the least aggressive state within the page ceiling; otherwise the last state.
 * `pageCounts[i]` is the measured page count of ladder state i. */
export function pickFittedLadderIndex(pageCounts: number[]): number {
  let bestWithinCeiling: number | null = null;
  for (let i = 0; i < pageCounts.length; i++) {
    if (pageCounts[i] <= 1) return i;
    if (pageCounts[i] <= PDF_PAGE_CEILING && bestWithinCeiling === null) bestWithinCeiling = i;
  }
  return bestWithinCeiling ?? Math.max(0, pageCounts.length - 1);
}
