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

