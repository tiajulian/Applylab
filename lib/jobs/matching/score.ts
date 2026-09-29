import { daysSince, formatSalaryRange, postedLabel } from "@/lib/jobs/format";

// Stage 3 of matching: a weighted rescore of the recalled candidates, every component 0-1, plus
// the short human-readable reasons shown on each job card. Pure - no I/O - so it is deterministic
// for fixed inputs.

const RECENCY_WINDOW_DAYS = 30;
const RECENT_REASON_DAYS = 7;
// text-embedding-3-small puts loosely related jobs around 0.4 cosine similarity, so only claim
// "similar" well above that.
const SIMILAR_REASON_MIN = 0.55;
const MAX_REASONS = 4;
const MAX_SKILLS_IN_REASON = 3;

export interface MatchWeights {
  semantic: number;
  title: number;
  skills: number;
  salary: number;
  recency: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = { semantic: 0.55, title: 0.2, skills: 0.1, salary: 0.1, recency: 0.05 };

/** Parses MATCH_WEIGHTS ("semantic,title,skills,salary,recency"), falling back to the defaults. */
export function parseWeights(raw: string | undefined): MatchWeights {
  if (!raw) return DEFAULT_WEIGHTS;
  const values = raw.split(",").map((v) => Number(v.trim()));
  if (values.length !== 5 || values.some((v) => !Number.isFinite(v) || v < 0)) {
    console.warn("MATCH_WEIGHTS must be 5 non-negative numbers, using defaults");
    return DEFAULT_WEIGHTS;
  }
  const [semantic, title, skills, salary, recency] = values;
  return { semantic, title, skills, salary, recency };
}

export interface ScoringProfile {
  targetTitles: string[];
  skills: string[];
  minSalary: number | null;
}

export interface Candidate {
  id: string;
  title: string;
  description_snippet: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_is_predicted: boolean;
  posted_at: string | null;
  /** Cosine distance to the profile embedding (0 = identical). */
  distance: number;
}

export interface ScoredMatch {
  jobId: string;
  /** Weighted score, 0-1. Shown to users as a 0-100 percentage. */
  score: number;
  reasons: string[];
}

// Pairs that should count as the same skill. Keys and values are lowercase.
const SKILL_SYNONYMS: string[][] = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["react", "react.js", "reactjs"],
  ["node.js", "nodejs", "node"],
  ["vue", "vue.js", "vuejs"],
  ["postgresql", "postgres"],
  ["kubernetes", "k8s"],
  ["amazon web services", "aws"],
  ["google cloud", "gcp"],
  ["c#", "csharp"],
  ["machine learning", "ml"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["registered nurse", "rn"],
  ["microsoft excel", "excel"],
];

const SYNONYMS_BY_TERM = new Map<string, string[]>(
  SKILL_SYNONYMS.flatMap((group) => group.map((term) => [term, group] as [string, string[]]))
);

const TITLE_STOPWORDS = new Set(["a", "an", "and", "at", "for", "in", "of", "or", "the", "to", "with"]);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .map((t) => t.replace(/^\.+|\.+$/g, ""))
      .filter((t) => t && !TITLE_STOPWORDS.has(t))
  );
}

/** Dice coefficient over title words: 1 for identical word sets, 0 for no overlap. */
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

/** True when every word of the target title appears in the job title ("Senior Frontend
 * Developer" covers "Frontend Developer"; "Mechanical Engineer" does not cover "Software Engineer"). */
export function coversTitle(jobTitle: string, target: string): boolean {
  const jobTokens = titleTokens(jobTitle);
  const targetTokens = titleTokens(target);
  return targetTokens.size > 0 && [...targetTokens].every((t) => jobTokens.has(t));
}

// Letters/digits on either side mean "inside another word"; symbols like + # . are part of skills.
function mentions(text: string, term: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, "i").test(text);
}

/** The user's skills (their own spelling) found as whole words in the text, synonyms included. */
export function matchedSkills(skills: string[], text: string): string[] {
  return skills.filter((skill) => {
    const term = skill.trim().toLowerCase();
    if (!term) return false;
    return (SYNONYMS_BY_TERM.get(term) ?? [term]).some((t) => mentions(text, t));
  });
}

function salaryComponent(job: Candidate, minSalary: number | null): number {
  const top = job.salary_max ?? job.salary_min;
  if (!minSalary || top === null || job.salary_is_predicted) return 0.5;
  return top >= minSalary ? 1 : 0;
}

export function scoreCandidate(
  job: Candidate,
  profile: ScoringProfile,
  weights: MatchWeights,
  now: number
): ScoredMatch {
  const semantic = clamp01(1 - job.distance);

  const title = Math.max(0, ...profile.targetTitles.map((target) => titleSimilarity(job.title, target)));
  const coveredTitle = profile.targetTitles.find((target) => coversTitle(job.title, target));

  const skillsFound = matchedSkills(profile.skills, `${job.title} ${job.description_snippet}`);
  const skills = profile.skills.length ? skillsFound.length / profile.skills.length : 0;
  const salary = salaryComponent(job, profile.minSalary);
  const days = daysSince(job.posted_at, now);
  const recency = days === null ? 0 : clamp01(1 - days / RECENCY_WINDOW_DAYS);

  const score =
    weights.semantic * semantic +
    weights.title * title +
    weights.skills * skills +
    weights.salary * salary +
    weights.recency * recency;

  const reasons: string[] = [];
  if (coveredTitle) reasons.push(`Title matches ${coveredTitle}`);
  if (skillsFound.length) reasons.push(`Mentions ${skillsFound.slice(0, MAX_SKILLS_IN_REASON).join(", ")}`);
  const range = formatSalaryRange(job.salary_min, job.salary_max);
  if (range) {
    const label = job.salary_is_predicted ? `Estimated salary ${range}` : `Salary ${range}`;
    const top = job.salary_max ?? job.salary_min!;
    if (!profile.minSalary) reasons.push(label);
    else if (top >= profile.minSalary) reasons.push(`${label} meets your minimum`);
  }
  if (days !== null && days <= RECENT_REASON_DAYS) reasons.push(postedLabel(days));
  if (reasons.length < 2 && semantic >= SIMILAR_REASON_MIN) reasons.push("Similar to your profile");

  return { jobId: job.id, score: clamp01(score), reasons: reasons.slice(0, MAX_REASONS) };
}

/** Scores every candidate and returns the best `limit`, highest first (ties broken by job id). */
export function rankCandidates(
  candidates: Candidate[],
  profile: ScoringProfile,
  weights: MatchWeights,
  now: number,
  limit: number
): ScoredMatch[] {
  return candidates
    .map((job) => scoreCandidate(job, profile, weights, now))
    .sort((a, b) => b.score - a.score || a.jobId.localeCompare(b.jobId))
    .slice(0, limit);
}

export const toPercent = (score: number) => Math.round(score * 100);
