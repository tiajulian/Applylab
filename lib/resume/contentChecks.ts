import { stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import type { ResumeContent } from "@/types";

// "Maintain a list" per the feature spec — representative, not exhaustive NLP.
export const STRONG_VERBS = [
  "led", "managed", "delivered", "developed", "implemented", "drove", "built", "designed",
  "analysed", "analyzed", "increased", "reduced", "negotiated", "launched", "created",
  "improved", "streamlined", "coordinated", "established", "spearheaded", "executed",
  "optimised", "optimized", "automated", "resolved", "trained", "mentored", "presented",
  "partnered", "facilitated", "produced", "generated", "achieved", "restructured",
];

export const BUZZWORDS = [
  "team player", "hard worker", "results-oriented", "results oriented", "detail-oriented",
  "detail oriented", "hardworking", "hard-working", "self-starter", "self starter",
  "go-getter", "go getter", "think outside the box", "synergy", "dynamic individual",
  "highly motivated", "proven track record", "excellent communication skills",
];

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

function findBuzzword(bullet: string): string | null {
  const lower = bullet.toLowerCase();
  return BUZZWORDS.find((phrase) => lower.includes(phrase)) ?? null;
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

export function analyzeResume(resume: ResumeContent): DeterministicFindings {
  const bullets = resume.experience.flatMap((entry) => entry.bullets).filter((b) => b.trim());
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
    projectBullets.reduce((sum, b) => sum + wordCount(b), 0) +
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

export function brevityScore(findings: DeterministicFindings): number {
  if (findings.totalBullets === 0) return 0;

  let score = 100;
  if (findings.avgBulletLength > 30) score -= 30;
  else if (findings.avgBulletLength > 22) score -= 15;
  if (findings.avgBulletLength < 6) score -= 15;
  if (findings.estimatedPages > 3) score -= 30;
  else if (findings.estimatedPages > 2) score -= 10;

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
