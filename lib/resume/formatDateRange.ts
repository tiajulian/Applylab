// The rest of the app deliberately never uses em/en dashes (see lib/text/sanitizeDashes.ts) - all
// generated content gets a plain hyphen instead. This is a narrow, explicitly-approved exception
// for the resume templates' own static date-range/company-location formatting, matching a
// reference style the templates are being brought closer to. It only touches how the template
// DISPLAYS an already-generated, already-sanitized value - it never changes what gets generated
// or stored, so it can't reintroduce a dash into anything the honesty/sanitization pipeline cares
// about.
export const EM_DASH = "—";

/** For the two-field case (experience start_date/end_date): join with an em dash. */
export function formatDateRange(start: string, end: string): string {
  return `${start} ${EM_DASH} ${end}`;
}

/**
 * For a single stored range string (education/project "year", e.g. "2020 - 2022" - the sanitizer
 * always normalizes generated date ranges to that exact " - " form): swap the hyphen separator
 * for an em dash for display, without touching anything else in the string.
 */
export function emDashifyRange(text: string): string {
  return text.replace(/(\S)\s-\s(\S)/, `$1 ${EM_DASH} $2`);
}
