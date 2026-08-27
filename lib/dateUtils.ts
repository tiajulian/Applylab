/**
 * Australian / Melbourne timezone date utilities.
 *
 * Enforces `Australia/Melbourne` for calendar arithmetic, formatting, and relative day distances
 * so that candidate dates (e.g. interviews, ad close dates, stale applications) evaluate correctly
 * across DST boundaries and do not drift with the user's or server's local UTC offset.
 */

export const AU_TIMEZONE = "Australia/Melbourne";

/**
 * Returns a Date formatted as YYYY-MM-DD in the Melbourne timezone.
 */
export function getMelbourneDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: AU_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d); // Returns YYYY-MM-DD
}

/**
 * Parses YYYY-MM-DD or ISO date string into year, month, day components in Melbourne timezone.
 */
export function getMelbourneParts(date: Date | string | number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
} {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: AU_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const find = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: parseInt(find("year"), 10),
    month: parseInt(find("month"), 10),
    day: parseInt(find("day"), 10),
    hour: parseInt(find("hour"), 10) || 0,
    minute: parseInt(find("minute"), 10) || 0,
    weekday: find("weekday"),
  };
}

/**
 * Calculates calendar day difference between two dates in Melbourne timezone: (target - base).
 * Positive = target is in the future.
 * Negative = target is in the past.
 * 0 = same calendar day in Melbourne.
 */
export function diffCalendarDaysMelbourne(
  targetDate: Date | string,
  baseDate: Date | string = new Date()
): number {
  const targetStr = typeof targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    ? targetDate
    : getMelbourneDateString(targetDate);
  const baseStr = typeof baseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(baseDate)
    ? baseDate
    : getMelbourneDateString(baseDate);

  const [tY, tM, tD] = targetStr.split("-").map(Number);
  const [bY, bM, bD] = baseStr.split("-").map(Number);

  // UTC Date constructor avoids timezone offset jitter
  const tUtc = Date.UTC(tY, tM - 1, tD);
  const bUtc = Date.UTC(bY, bM - 1, bD);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((tUtc - bUtc) / msPerDay);
}

/**
 * Formats a date in standard en-AU format (e.g. "Thu 3 Sep", "3 Sep 2026").
 */
export function formatEnAuDate(
  date: Date | string,
  options?: { includeYear?: boolean; includeTime?: boolean; shortMonth?: boolean }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const includeYear = options?.includeYear ?? false;
  const includeTime = options?.includeTime ?? false;

  const formatter = new Intl.DateTimeFormat("en-AU", {
    timeZone: AU_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: options?.shortMonth !== false ? "short" : "long",
    ...(includeYear ? { year: "numeric" } : {}),
    ...(includeTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  });

  return formatter.format(d);
}

/**
 * Returns a human-friendly relative distance string in Melbourne timezone.
 * e.g.:
 * - "today" / "due today"
 * - "tomorrow" / "due tomorrow"
 * - "in 5 days" / "due in 5 days"
 * - "yesterday"
 * - "5 days ago"
 */
export function formatRelativeDistanceMelbourne(
  targetDate: Date | string,
  baseDate: Date | string = new Date(),
  isDeadline = false
): string {
  const days = diffCalendarDaysMelbourne(targetDate, baseDate);

  if (isDeadline) {
    if (days === 0) return "due today";
    if (days === 1) return "due tomorrow";
    if (days > 1) return `due in ${days} days`;
    if (days === -1) return "due yesterday";
    return `due ${Math.abs(days)} days ago`;
  }

  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days} days`;
  if (days === -1) return "yesterday";
  return `${Math.abs(days)} days ago`;
}

/**
 * Format interview display line (e.g. "Thu 3 Sep, 10:00 am (in 5 days)" or "due by Fri 5 Sep").
 */
export function formatInterviewDateTime(
  scheduledAt: string,
  isDeadline = false
): {
  formattedDate: string;
  formattedTime: string;
  relative: string;
  isPast: boolean;
} {
  const d = new Date(scheduledAt);
  const days = diffCalendarDaysMelbourne(d);
  const isPast = days < 0;

  const dateStr = new Intl.DateTimeFormat("en-AU", {
    timeZone: AU_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);

  const timeStr = new Intl.DateTimeFormat("en-AU", {
    timeZone: AU_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);

  const relative = formatRelativeDistanceMelbourne(d, new Date(), isDeadline);

  return {
    formattedDate: dateStr,
    formattedTime: timeStr,
    relative,
    isPast,
  };
}

/**
 * Format ad closing tag text (e.g. "Closes today", "Closes tomorrow", "Closes Thu", "Closes 12 Sep", "Closed 12 Sep").
 */
export function formatAdCloseText(
  closesAtDate: string,
  baseDate: Date | string = new Date()
): {
  text: string;
  isClosed: boolean;
  isUrgent: boolean; // within 7 days
} {
  const days = diffCalendarDaysMelbourne(closesAtDate, baseDate);
  const isClosed = days < 0;
  const isUrgent = days >= 0 && days <= 7;

  if (isClosed) {
    const formatted = formatEnAuDate(closesAtDate, { shortMonth: true });
    return { text: `Closed ${formatted}`, isClosed: true, isUrgent: false };
  }

  if (days === 0) {
    return { text: "Closes today", isClosed: false, isUrgent: true };
  }
  if (days === 1) {
    return { text: "Closes tomorrow", isClosed: false, isUrgent: true };
  }
  if (days <= 7) {
    const parts = getMelbourneParts(closesAtDate);
    return { text: `Closes ${parts.weekday}`, isClosed: false, isUrgent: true };
  }

  const d = new Date(closesAtDate);
  const thisYear = getMelbourneParts(baseDate).year;
  const targetYear = getMelbourneParts(d).year;
  const formatted = formatEnAuDate(d, { includeYear: targetYear !== thisYear, shortMonth: true });
  return { text: `Closes ${formatted}`, isClosed: false, isUrgent: false };
}
