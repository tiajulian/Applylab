// Shared by lib/profile/validate.ts (catches bad dates at profile entry) and
// lib/resume/qualityGate.ts (backstop check after generation) so the two layers never drift on
// what counts as a parseable date - see the division-of-labour note in validate.ts.

export const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export const PRESENT_WORDS = new Set(["present", "current", "now"]);

/** Parses a free-text role date ("March 2022", "2022", "Present") into a sortable month index
 * (year * 12 + month). When only a year is given, `fallbackMonth` decides which end of that year
 * to assume - callers pass the value that makes their check conservative (least likely to
 * false-positive), not necessarily the most likely reading. Returns null when nothing date-like
 * is found, since free text here can't always be parsed and an unparseable date should never be
 * treated as a contradiction. */
export function parseRoleDate(raw: string, fallbackMonth: number): number | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  if (PRESENT_WORDS.has(text.toLowerCase())) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }

  const yearMatch = text.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[0], 10);

  const monthWord = text.toLowerCase().match(/[a-z]+/)?.[0];
  const month = monthWord && monthWord in MONTH_INDEX ? MONTH_INDEX[monthWord] : fallbackMonth;
  return year * 12 + month;
}
