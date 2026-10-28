/**
 * Job-ad filler and unbacked benefit claims the resume summary keeps reaching for despite the
 * NO JOB-AD WORDING rule (seen live: "proven track record", "actionable insights", "improving
 * operational efficiency"). Kept narrow on purpose: each one either asserts an outcome nobody
 * supplied or says nothing a recruiter can check. An occurrence inside the candidate's own wording
 * (job title, employer, skill, confirmed competency) is never filler - see `protectedTerms`.
 * Pure (no AI/server imports) so the editor's reviewer can share it with generation's backstop.
 */
export const SUMMARY_FILLER: RegExp[] = [
  /proven track record/gi,
  /actionable insights?/gi,
  /operational efficiency/gi,
  /improv\w* efficiency/gi,
  /business value/gi,
  /data[- ](?:driven|informed) decision[- ]making/gi,
  /cross[- ]functional stakeholders?/gi,
  /\b(?:data|business|reporting|technical|innovative|scalable|reliable|automated|digital|effective) solutions\b/gi,
  /results[- ]driven/gi,
  /\bleverag\w*/gi,
  /\brobust\b/gi,
];

/** The rest of generation's NO JOB-AD WORDING list (lib/anthropic/generateResume.ts), checked by the
 * editor's reviewer on any text. Not used by the summary backstop, which drops whole sentences. */
export const JOB_AD_FILLER: RegExp[] = [
  ...SUMMARY_FILLER,
  /\bbest[- ]practices?\b/gi,
  /\bend[- ]to[- ]end\b/gi,
  /\bscalable\b/gi,
  /\bsynerg\w*/gi,
  /\bvarious\b/gi,
  /\bensur\w* compliance\b/gi,
  /\bstreamlin\w* operations\b/gi,
  /\binform\w* decision[- ]making\b/gi,
];

export interface FillerMatch {
  start: number;
  end: number;
  text: string;
}

/** [start, end) spans of every occurrence of every protected term in `textLower`. */
export function protectedSpans(textLower: string, protectedTerms: string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const term of protectedTerms) {
    const t = term.trim().toLowerCase();
    if (!t) continue;
    for (let i = textLower.indexOf(t); i !== -1; i = textLower.indexOf(t, i + 1)) spans.push([i, i + t.length]);
  }
  return spans;
}

/**
 * Every filler occurrence in `text`, in text order, overlapping matches merged into the first. An
 * occurrence that sits inside one of the candidate's own `protectedTerms` is their fact, not filler;
 * another occurrence of the same phrase elsewhere still counts.
 */
export function findFiller(text: string, patterns: RegExp[], protectedTerms: string[] = []): FillerMatch[] {
  const spans = protectedSpans(text.toLowerCase(), protectedTerms);
  const found: FillerMatch[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!spans.some(([s, e]) => s <= start && end <= e)) found.push({ start, end, text: m[0] });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: FillerMatch[] = [];
  for (const match of found) if (!merged.length || match.start >= merged[merged.length - 1].end) merged.push(match);
  return merged;
}
