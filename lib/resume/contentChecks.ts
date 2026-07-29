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

const PASSIVE_REGEX = /\b(was|were|is|are|been|being)\s+\w+ed\b/i;
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

export function analyzeResume(resume: ResumeContent): DeterministicFindings {
  const bullets = resume.experience.flatMap((entry) => entry.bullets).filter((b) => b.trim());
  const totalBullets = bullets.length;

  const avgBulletLength = totalBullets
    ? Math.round(bullets.reduce((sum, b) => sum + wordCount(b), 0) / totalBullets)
    : 0;

  const strongVerbCount = bullets.filter(startsWithStrongVerb).length;
  const strongVerbPct = totalBullets ? Math.round((strongVerbCount / totalBullets) * 100) : 0;

  const metricCount = bullets.filter((b) => METRIC_REGEX.test(b)).length;
  const metricPct = totalBullets ? Math.round((metricCount / totalBullets) * 100) : 0;

  const hasSummary = resume.summary.trim().length > 0;

  const totalWords =
    wordCount(resume.summary) +
    bullets.reduce((sum, b) => sum + wordCount(b), 0) +
    wordCount(resume.skills.join(" "));
  const estimatedPages = Math.max(1, Math.round((totalWords / 500) * 10) / 10);

  const passiveVoiceBullets = bullets.filter((b) => PASSIVE_REGEX.test(b));

  const buzzwordBullets = bullets.reduce<Array<{ bullet: string; phrase: string }>>((acc, bullet) => {
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
