const MONTHS = new Set([
  "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may",
  "jun", "june", "jul", "july", "aug", "august", "sep", "sept", "september",
  "oct", "october", "nov", "november", "dec", "december",
]);

const YEAR_REGEX = /^(19|20)\d{2}$/;
const DIGIT_REGEX = /^\d+$/;
const PRESENT_REGEX = /^(present|current|now)$/i;

function isDateToken(token: string): boolean {
  const clean = token.replace(/[,.]$/, "");
  if (clean === "") return false;
  return YEAR_REGEX.test(clean) || DIGIT_REGEX.test(clean) || PRESENT_REGEX.test(clean) || MONTHS.has(clean.toLowerCase());
}

function lastToken(text: string): string {
  const parts = text.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

function firstToken(text: string): string {
  return text.trim().split(/\s+/)[0] ?? "";
}

/**
 * Deterministic safety net behind the prompt-level "never use em dashes" rule. A dash flanked by
 * date-like tokens on both sides (years, months, "Present") is a date range and becomes a plain
 * hyphen (spaced, regardless of the original spacing); every other dash is prose punctuation and
 * becomes a comma, since that's the closest equivalent for both em and en dash usage in resume
 * text. The regex only consumes the dash and its surrounding whitespace, not the flanking words,
 * so token lookup for one dash can't be corrupted by an adjacent dash's replacement.
 */
export function sanitizeDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, (match: string, offset: number, full: string) => {
    const before = lastToken(full.slice(0, offset));
    const after = firstToken(full.slice(offset + match.length));
    if (isDateToken(before) && isDateToken(after)) return " - ";
    if (!before || !after) return "";
    const prefix = full.slice(0, offset).trimEnd();
    if (prefix.endsWith(",") || prefix.endsWith(";") || prefix.endsWith(":") || prefix.endsWith(".")) {
      return " ";
    }
    return ", ";
  });
}

export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeDashes(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, sanitizeDeep(val)])
    ) as T;
  }
  return value;
}
