import { stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import type { ResumeContent } from "@/types";
import { TOOL_CATALOG } from "@/lib/wins/toolCatalog";
import { escapeRegExp } from "@/lib/text/escapeRegExp";
import { protectedSpans } from "@/lib/text/jobAdFiller";

// "Maintain a list" per the feature spec — representative, not exhaustive NLP.
export const STRONG_VERBS = [
  "led", "managed", "delivered", "developed", "implemented", "drove", "built", "designed",
  "analysed", "analyzed", "increased", "reduced", "negotiated", "launched", "created",
  "improved", "streamlined", "coordinated", "established", "spearheaded", "executed",
  "optimised", "optimized", "automated", "resolved", "trained", "mentored", "presented",
  "partnered", "facilitated", "produced", "generated", "achieved", "restructured",
  "owned", "cut",
];

export const BUZZWORDS = [
  "team player", "hard worker", "results-oriented", "results oriented", "detail-oriented",
  "detail oriented", "hardworking", "hard-working", "self-starter", "self starter",
  "go-getter", "go getter", "think outside the box", "synergy", "dynamic individual",
  "highly motivated", "proven track record", "excellent communication skills",
  "results-driven", "results driven",
];

export const CONTEXT_BUZZWORDS = ["end-to-end", "end to end", "cross-functional", "cross functional", "stakeholder management", "data-driven", "data driven"];
const NAMED_TOOL_REGEX = new RegExp(`(?<![A-Za-z0-9])(?:${TOOL_CATALOG.map(escapeRegExp).join("|")})(?![A-Za-z0-9])`);

/** Two independent signs of substance earn scope/method wording; clichés never do. */
export function shouldFlagBuzzword(plainBullet: string, phrase: string): boolean {
  if (!CONTEXT_BUZZWORDS.includes(phrase.toLowerCase())) return true;
  // Reuse the tool catalogue (including lowercase dbt); proper nouns cover unknown systems.
  const withoutPhrase = plainBullet.replace(new RegExp(escapeRegExp(phrase), "gi"), "");
  const afterOpener = plainBullet.trim().replace(/^\S+\s*/, "").replace(new RegExp(escapeRegExp(phrase), "gi"), "");
  const namedSystem = NAMED_TOOL_REGEX.test(withoutPhrase) || /\b[A-Z][A-Za-z0-9.+]*\b/.test(afterOpener);
  const concreteObject = new RegExp(`${escapeRegExp(phrase)}\\s+(?:(?!(?:solutions?|support|initiatives?|ownership)\\b)[a-z]+\\s+){0,3}(?:pipelines?|rollouts?|migrations?|dashboards?|reports?|databases?|models?|websites?|applications?|audits?|budgets?|workshops?|training|deployments?|integrations?|accreditation)\\b`, "i").test(plainBullet);
  const evidence = [METRIC_REGEX.test(plainBullet), namedSystem, startsWithStrongVerb(plainBullet), concreteObject];
  return evidence.filter(Boolean).length < 2;
}

export function buzzwordReason(phrase: string): string {
  if (/^end[- ]to[- ]end$/i.test(phrase)) return `'${phrase}' is common in job ads. Name the stages you owned instead.`;
  if (BUZZWORDS.includes(phrase.toLowerCase())) return `Buzzword: '${phrase}'. Show this with a specific action or result.`;
  return `'${phrase}' is common in job ads. Name the work or result it describes.`;
}

/** Only remove a sentence-opening cliché when the remainder is already a complete action. */
export function groundedBuzzwordExample(plainBullet: string, phrase: string): string | null {
  if (!BUZZWORDS.includes(phrase.toLowerCase())) return null;
  const prefix = `${phrase.toLowerCase()} who `;
  if (!plainBullet.toLowerCase().startsWith(prefix)) return null;
  const remainder = plainBullet.slice(prefix.length).trim();
  return startsWithStrongVerb(remainder) ? remainder[0].toUpperCase() + remainder.slice(1) : null;
}

export const PASSIVE_REGEX = /\b(was|were|is|are|been|being)\s+\w+ed\b/i;
const METRIC_REGEX = /\d|%|\$/;

export interface DeterministicFindings {
  totalBullets: number;
  avgBulletLength: number;
  strongVerbPct: number;
  metricPct: number;
  hasSummary: boolean;
  estimatedPages: number;
  passiveVoiceBullets: string[];
  buzzwordBullets: Array<{ bullet: string; phrase: string }>;
}

function firstWord(text: string): string {
  const match = text.trim().match(/^[A-Za-z]+/);
  return match ? match[0].toLowerCase() : "";
}

function startsWithStrongVerb(bullet: string): boolean {
  return STRONG_VERBS.includes(firstWord(bullet));
}

export function findBuzzwordMatch(bullet: string, protectedTerms: string[] = []): { phrase: string; start: number; end: number } | null {
  const protectedRanges = protectedSpans(bullet.toLowerCase(), protectedTerms);
  for (const phrase of [...BUZZWORDS, ...CONTEXT_BUZZWORDS]) {
    const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(phrase)}(?![A-Za-z0-9])`, "gi");
    for (const match of bullet.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      // Clichés still count; protected skill names only exempt meaningful context phrases.
      if (CONTEXT_BUZZWORDS.includes(phrase) && protectedRanges.some(([s, e]) => s <= start && end <= e)) continue;
      if (shouldFlagBuzzword(bullet, phrase)) return { phrase, start, end };
    }
  }
  return null;
}

export function findBuzzword(bullet: string): string | null {
  return findBuzzwordMatch(bullet)?.phrase ?? null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface BulletChipSuggestion {
  action: "rewrite" | "quantify" | "shorten" | "senior";
  label: string;
}

/**
 * Picks 2-3 short, content-aware suggestion chips for one bullet, reusing the same detectors
 * `analyzeResume` uses resume-wide (metric presence, buzzwords, passive/weak verbs, length) -
 * replaces a fixed always-the-same-four-actions menu with one tied to what's actually wrong with
 * THIS bullet. Deduplicated by action (two chips that would trigger the identical backend call
 * would just be confusing), topped up with fixed fallbacks so an already-strong bullet still gets
 * a sensible pair rather than an empty menu.
 */
export function suggestBulletChips(bulletText: string): BulletChipSuggestion[] {
  bulletText = stripBulletMarkup(bulletText);
  const chips: BulletChipSuggestion[] = [];
  const seen = new Set<BulletChipSuggestion["action"]>();
  const add = (action: BulletChipSuggestion["action"], label: string) => {
    if (seen.has(action)) return;
    seen.add(action);
    chips.push({ action, label });
  };

  if (!METRIC_REGEX.test(bulletText)) add("quantify", "Add a metric");
  const buzzword = findBuzzword(bulletText);
  if (buzzword) add("rewrite", "Cut the fluff");
  if (PASSIVE_REGEX.test(bulletText) || !startsWithStrongVerb(bulletText)) add("rewrite", "Sharpen this line");
  if (wordCount(bulletText) > 30) add("shorten", "Tighten this up"); // matches brevityScore's own too-long threshold

  // Fallbacks - guarantee at least 2 chips even for a bullet with no detected issues.
  add("senior", "Sound more senior");
  add("rewrite", "How would a recruiter read this?");

  return chips.slice(0, 3);
}

export function analyzeResume(resume: ResumeContent, options: { includeProjects?: boolean } = {}): DeterministicFindings {
  const bullets = [
    ...resume.experience.flatMap((entry) => entry.bullets),
    ...(options.includeProjects ? resume.projects.flatMap((project) => project.bullets) : []),
  ].filter((b) => b.trim());
  const totalBullets = bullets.length;

  const avgBulletLength = totalBullets
    ? Math.round(bullets.reduce((sum, b) => sum + wordCount(b), 0) / totalBullets)
    : 0;

  // Bold/italic markers (lib/resume/bulletMarkup.ts) live inside the raw bullet string - a bullet
  // that opens with a bolded verb, or has a buzzword/passive phrase split by a marker, must still
  // be detected the same as its unformatted counterpart, so every check below runs against the
  // stripped text (never the raw one). See styleItems in lib/review/rules.ts for the sibling fix
  // in the review pipeline.
  const plainBullets = bullets.map(stripBulletMarkup);

  const strongVerbCount = plainBullets.filter(startsWithStrongVerb).length;
  const strongVerbPct = totalBullets ? Math.round((strongVerbCount / totalBullets) * 100) : 0;

  const metricCount = bullets.filter((b) => METRIC_REGEX.test(b)).length;
  const metricPct = totalBullets ? Math.round((metricCount / totalBullets) * 100) : 0;

  const hasSummary = resume.summary.trim().length > 0;

  const projectBullets = resume.projects.flatMap((project) => project.bullets);
  const totalWords =
    wordCount(resume.summary) +
    bullets.reduce((sum, b) => sum + wordCount(b), 0) +
    (options.includeProjects ? 0 : projectBullets.reduce((sum, b) => sum + wordCount(b), 0)) +
    wordCount(resume.skills.join(" ")) +
    wordCount(resume.tools.join(" "));
  const estimatedPages = Math.max(1, Math.round((totalWords / 500) * 10) / 10);

  const passiveVoiceBullets = plainBullets.filter((b) => PASSIVE_REGEX.test(b));

  const buzzwordBullets = plainBullets.reduce<Array<{ bullet: string; phrase: string }>>((acc, bullet) => {
    const phrase = findBuzzword(bullet);
    if (phrase) acc.push({ bullet, phrase });
    return acc;
  }, []);

  return {
    totalBullets,
    avgBulletLength,
    strongVerbPct,
    metricPct,
    hasSummary,
    estimatedPages,
    passiveVoiceBullets,
    buzzwordBullets,
  };
}

export function brevityScore(findings: DeterministicFindings, options: { includeLength?: boolean } = {}): number {
  if (findings.totalBullets === 0) return 0;

  let score = 100;
  if (findings.avgBulletLength > 30) score -= 30;
  else if (findings.avgBulletLength > 22) score -= 15;
  if (findings.avgBulletLength < 6) score -= 15;
  if (options.includeLength !== false) {
    if (findings.estimatedPages > 3) score -= 30;
    else if (findings.estimatedPages > 2) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

export function completenessScore(resume: ResumeContent, findings: DeterministicFindings): number {
  let score = 0;
  if (findings.hasSummary) score += 20;
  if (resume.skills.length >= 3) score += 20;
  if (findings.totalBullets >= 3) score += 30;
  if (resume.education.length > 0) score += 15;
  if (resume.referees.length >= 2) score += 15;

  return Math.max(0, Math.min(100, score));
}
