// Shared by lib/profile/validate.ts (catches bad dates at profile entry) and
// lib/resume/qualityGate.ts (backstop check after generation) so the two layers never drift on
// what counts as a parseable date - see the division-of-labour note in validate.ts.

export const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export const PRESENT_WORDS = new Set(["present", "current", "now", "ongoing"]);

const YEAR_REGEX = /(19|20)\d{2}/;

export function nowMonthIndex(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth();
}

/** How far past "now" a date can be before lib/profile/validate.ts and the post-generation
 * quality gate (lib/resume/qualityGate.ts) both flag it as an obvious mistake rather than a
 * legitimate near-future plan. Wide enough to cover every value the MonthYearField year picker
 * actually offers (up to December of next year, e.g. a "starting January 2027" role already
 * accepted, or an "expected May 2027" graduation) - narrower than that and the picker would offer
 * choices these checks immediately reject. Still catches a genuine typo (e.g. a decade-off year). */
export const FUTURE_TOLERANCE_MONTHS = 23;

/** end_date reading that trusts the explicit is_current flag over free-text end_date (which is
 * empty once a role/qualification uses the flag) - the single shared source for the "Current"
 * label everywhere a WorkExperienceEntry/EducationEntry's end date is displayed or embedded in a
 * generation prompt, so the flag and the displayed text can never drift apart. */
export function currentAwareEndDate(entry: { end_date: string; is_current: boolean }): string {
  return entry.is_current ? "Current" : entry.end_date;
}

/** end_date reading as a sortable month index rather than display text - same is_current-trusts-
 * over-free-text rule as currentAwareEndDate, the single shared source for both
 * lib/profile/validate.ts's date-validity checks and lib/resume/qualityGate.ts's post-generation
 * backstop, so the two layers can never drift on what "now" or "current" means. */
export function parseEntryEnd(entry: { end_date: string; is_current: boolean }, fallbackMonth: number): number | null {
  return entry.is_current ? nowMonthIndex() : parseRoleDate(entry.end_date, fallbackMonth);
}

export interface MonthYearParts {
  monthIndex: number | null;
  year: string;
}

/** Extracts a month name/abbreviation and a 4-digit year from free text, independently of each
 * other - the low-level parse parseRoleDate uses internally, exposed so UI code (the Month/Year
 * picker) can read a stored string into its two parts without a second, independently-maintained
 * copy of the year/month regexes. */
export function parseMonthYearParts(raw: string): MonthYearParts {
  const text = (raw ?? "").trim();
  if (!text) return { monthIndex: null, year: "" };

  const yearMatch = text.match(YEAR_REGEX);
  const year = yearMatch ? yearMatch[0] : "";
  const monthWord = text.toLowerCase().match(/[a-z]+/)?.[0];
  const monthIndex = monthWord && monthWord in MONTH_INDEX ? MONTH_INDEX[monthWord] : null;
  return { monthIndex, year };
}

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
    return nowMonthIndex();
  }

  const { monthIndex, year } = parseMonthYearParts(text);
  if (!year) return null;
  return parseInt(year, 10) * 12 + (monthIndex ?? fallbackMonth);
}

/** Reverse-chronological sort (most recent first) - the standard resume convention - for any
 * entry with a start_date/end_date/is_current shape (WorkExperienceEntry, EducationEntry). Ties
 * (same end month, or two concurrent `is_current` entries) break on start date, most recent
 * first. Entries with no parseable date at all keep their original relative order and sort last,
 * since there's nothing to compare them by - never dropped or reordered arbitrarily. Missing
 * dates sort as -Infinity so the comparator itself stays a single arithmetic expression rather
 * than a chain of null-checks. */
export function sortByRecency<T extends { start_date: string; end_date: string; is_current: boolean }>(
  entries: T[]
): T[] {
  return entries
    .map((entry, index) => {
      const start = parseRoleDate(entry.start_date, 0) ?? Number.NEGATIVE_INFINITY;
      const end = parseEntryEnd(entry, 11) ?? start;
      return { entry, index, end, start };
    })
    .sort((a, b) => b.end - a.end || b.start - a.start || a.index - b.index)
    .map((x) => x.entry);
}
