import { parseEntryEnd, parseRoleDate } from "@/lib/profile/parseRoleDate";
import type { WorkExperienceEntry } from "@/types";

/**
 * Years of experience the resume summary may claim: only roles related to the target title count,
 * never total career length. A 2009 barista job does not make someone an "Analytics Engineer with
 * 15 years of experience" when the analytics work started in 2023.
 */

/** Title words that say nothing about the field. */
const GENERIC_TITLE_WORDS = new Set([
  "senior", "snr", "junior", "jnr", "lead", "head", "principal", "chief", "associate", "assistant",
  "graduate", "intern", "trainee", "staff", "team", "member", "officer", "and", "the", "for", "with",
  "part", "time", "full", "casual", "contract", "temporary", "temp", "level",
  // Role nouns: "Store Manager" is no evidence for "Product Manager".
  "manager", "officer", "coordinator", "specialist", "consultant", "administrator", "supervisor",
  "worker", "representative", "executive", "director", "advisor", "adviser", "analyst", "engineer",
  "developer", "lead", "leader", "partner", "agent", "clerk",
]);

/** Short stems so "Analytics"/"Analysis" or "Software"/"Softwares" match. */
function titleStems(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 3 && !GENERIC_TITLE_WORDS.has(word))
      .map((word) => word.slice(0, 5))
  );
}

const normalizeTitle = (title: string) =>
  ` ${title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

export function isRelevantRole(role: Pick<WorkExperienceEntry, "job_title">, targetTitle: string): boolean {
  const wanted = normalizeTitle(targetTitle);
  if (wanted.trim() && normalizeTitle(role.job_title ?? "").includes(wanted)) return true;
  const target = titleStems(targetTitle);
  if (target.size === 0) return false;
  for (const stem of titleStems(role.job_title ?? "")) if (target.has(stem)) return true;
  return false;
}

export interface RelevantExperience {
  /** Whole years covered by the relevant roles, overlaps counted once. */
  years: number;
  roles: WorkExperienceEntry[];
}

export function relevantExperience(roles: WorkExperienceEntry[], targetTitle: string): RelevantExperience {
  const relevant = roles.filter((role) => isRelevantRole(role, targetTitle));
  // Conservative month range per role (latest plausible start, earliest plausible end).
  const spans = relevant
    .map((role) => ({ start: parseRoleDate(role.start_date, 11), end: parseEntryEnd(role, 0) }))
    .filter((s): s is { start: number; end: number } => s.start !== null && s.end !== null && s.end >= s.start)
    .sort((a, b) => a.start - b.start);

  let months = 0;
  let current: { start: number; end: number } | null = null;
  for (const span of spans) {
    if (current && span.start <= current.end) {
      current.end = Math.max(current.end, span.end);
    } else {
      if (current) months += current.end - current.start;
      current = { ...span };
    }
  }
  if (current) months += current.end - current.start;

  return { years: Math.floor(months / 12), roles: relevant };
}

/** The title the summary's identity is built on: the job applied for, else the most recent role's. */
export function summaryTargetTitle(jobTitle: string | null | undefined, roles: WorkExperienceEntry[]): string {
  return jobTitle?.trim() || roles[0]?.job_title || "";
}

/** Below this many relevant years the summary leaves the number out: "1 year" reads as padding. */
export const MIN_YEARS_TO_CLAIM = 2;

const YEARS_CLAIM = /(\d+)\s*\+?\s*(?:years?|yrs?)\b/gi;

/** Every "N years" claim in a summary. */
export function yearsClaims(summary: string): number[] {
  return Array.from(summary.matchAll(YEARS_CLAIM)).map((m) => parseInt(m[1], 10));
}

/**
 * Removes "N years of experience" phrases the relevant roles don't back. Covers the shapes the
 * prompt produces ("with over 15 years of experience", "15+ years' experience in ...,"); a claim in
 * any other shape is left for the quality gate to flag rather than cut mid-sentence.
 */
export function stripUnbackedYears(summary: string, maxYears: number): string {
  const allowed = maxYears >= MIN_YEARS_TO_CLAIM ? maxYears : 0;
  const phrase =
    /,?\s*(?:with|bringing|having)?\s*(?:over|more than|nearly|almost|around|about|close to|some)?\s*(\d+)\s*\+?\s*(?:years?|yrs?)(?:['’])?\s+(?:of\s+)?(?:[a-z-]+\s+){0,3}?experience(?:\s+(?:in|across)\s+[^,.;]+?)?(?=\s*[,.;])/gi;
  const cleaned = summary.replace(phrase, (match, years: string) => (parseInt(years, 10) > allowed ? "" : match));
  return cleaned.replace(/\s+([,.;])/g, "$1").replace(/\s{2,}/g, " ").trim();
}
