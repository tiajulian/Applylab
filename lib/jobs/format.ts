// Display formatting shared by the match reasons (server) and the job cards (client).

const DAY_MS = 86_400_000;

const formatK = (n: number) => `$${Math.round(n / 1000)}k`;

/** "$110k–$130k", "$90k" for a single figure, null when unknown. */
export function formatSalaryRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min === null || max === null || min === max) return formatK((max ?? min)!);
  return `${formatK(min)}–${formatK(max)}`;
}

/** Whole days since posting (never negative), or null when the date is unknown. */
export function daysSince(postedAt: string | null, now: number): number | null {
  if (!postedAt) return null;
  return Math.max(0, Math.floor((now - new Date(postedAt).getTime()) / DAY_MS));
}

export function postedLabel(days: number): string {
  if (days === 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  return `Posted ${days} days ago`;
}
