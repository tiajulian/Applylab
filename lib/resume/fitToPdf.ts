/** Same selection rule as renderResumeToFittedPdf (lib/pdf/pageFit.ts): the least aggressive
 * trim-ladder state that reaches the fewest pages - one page when any state fits it. The ladder
 * never cuts content, so tighter states that save no page are never worth their cramped layout.
 * `pageCounts[i]` is the measured page count of ladder state i. */
export function pickFittedLadderIndex(pageCounts: number[]): number {
  let best = 0;
  for (let i = 1; i < pageCounts.length; i++) {
    if (pageCounts[i] < pageCounts[best]) best = i;
  }
  return best;
}
