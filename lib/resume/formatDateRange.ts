// The rest of the app deliberately never uses em/en dashes (see lib/text/sanitizeDashes.ts) - all
// generated content gets a plain hyphen instead. The resume templates' own static date-range/
// company-location formatting uses the same plain hyphen, so this file only touches how the
// template DISPLAYS an already-generated, already-sanitized value - it never changes what gets
// generated or stored.
export const EM_DASH = "-";

/** For the two-field case (experience start_date/end_date): join with a hyphen. */
export function formatDateRange(start: string, end: string): string {
  return `${start} ${EM_DASH} ${end}`;
}

/**
 * For a single stored range string (education/project "year", e.g. "2020 - 2022" - the sanitizer
 * always normalizes generated date ranges to that exact " - " form): already in the display
 * format, so this is a no-op left in place to keep the call sites unchanged.
 */
export function emDashifyRange(text?: string | null): string {
  if (!text) return "";
  return text.replace(/(\S)\s-\s(\S)/, `$1 ${EM_DASH} $2`);
}

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

/** Convert a human date string like "June 2026" or "12/2024" to ISO format "2026-06". */
export function formatIsoDate(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return "";
  if (/^present|current$/i.test(trimmed)) return "Present";
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  // e.g. "June 2026", "Jun 2026"
  const monthYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    if (month) return `${monthYearMatch[2]}-${month}`;
  }

  // e.g. "06/2026", "6/2026"
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    return `${slashMatch[2]}-${month}`;
  }

  return trimmed;
}

/** Formats a date range into ISO format for Technical template. */
export function formatIsoDateRange(start: string, end: string): string {
  const isoStart = formatIsoDate(start);
  const isoEnd = formatIsoDate(end);
  return `${isoStart} ${EM_DASH} ${isoEnd}`;
}



