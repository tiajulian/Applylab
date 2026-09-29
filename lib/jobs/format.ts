// Display formatting shared by the match reasons (server) and the job cards (client).

const DAY_MS = 86_400_000;

const formatK = (n: number) => `$${Math.round(n / 1000)}k`;

/** "$110k–$130k", "$90k" for a single figure, null when unknown. */
export function formatSalaryRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const low = formatK((min ?? max)!);
  const high = formatK((max ?? min)!);
  // Two figures that round to the same "$Nk" read as one ("$111k", not "$111k–$111k").
  return low === high ? high : `${low}–${high}`;
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

// Match labels calibrated to the scorer (lib/jobs/matching/score.ts): semantic similarity tops out
// around 0.6-0.7 even for a close fit, so a job whose title matches the search lands near 60-70%.
const MATCH_LABELS: [min: number, label: string][] = [
  [65, "Strong match"],
  [55, "Good match"],
  [45, "Potential match"],
];

/** Descriptive band for a 0-100 match percentage; not used for ranking. */
export function matchLabel(percent: number): string {
  return MATCH_LABELS.find(([min]) => percent >= min)?.[1] ?? "Lower match";
}

const CONTRACT_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  permanent: "Permanent",
  contract: "Contract",
};

/** "Full-time · Permanent" from Adzuna's contract_time and contract_type, null when neither is known. */
export function contractLabel(contractTime: string | null, contractType: string | null): string | null {
  const parts = [contractTime, contractType].map((v) => (v ? CONTRACT_LABELS[v] : undefined)).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
