import type { ResumeContent, ResumeReviewFinding } from "@/types";
import { analyzeResume } from "./contentChecks";

export interface ReadinessCheckResult {
  score: number;
  maxPoints: number;
  findings: ResumeReviewFinding[];
}

export const MAX_READINESS_POINTS = 15;

function significantWords(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
}

/**
 * Deterministic application-readiness checks: page budget, contact link hygiene,
 * referee availability, redundancy/duplication, and general export hygiene.
 */
export function checkApplicationReadiness(resume: ResumeContent): ReadinessCheckResult {
  const findings: ResumeReviewFinding[] = [];
  let score = MAX_READINESS_POINTS;

  const analysis = analyzeResume(resume);

  // 1. Page Budget & Document Length (Max 5 pts)
  if (analysis.estimatedPages > 3) {
    score -= 4;
    findings.push({
      id: "ready-length-excessive",
      category_key: "application_readiness",
      severity: "warning",
      title: `Resume length exceeds 3 pages (~${analysis.estimatedPages} pages)`,
      detail: "Australian recruiters spend under 30 seconds on initial screening. A 3+ page resume creates skimming friction.",
      fix_text: "Trim older roles or reduce bullet counts to fit within a standard 1-2 page budget.",
      resume_location: "Full document",
    });
  } else if (analysis.estimatedPages > 2) {
    score -= 2;
    findings.push({
      id: "ready-length-long",
      category_key: "application_readiness",
      severity: "info",
      title: `Length reaches ${analysis.estimatedPages} pages`,
      detail: "Two pages is standard for experienced candidates; ensure the most impactful achievements sit on Page 1.",
      fix_text: "Condense secondary bullets to keep high-priority wins prominently positioned.",
      resume_location: "Full document",
    });
  }

  // 2. Link & Profile Hygiene (Max 3 pts)
  const linkedin = resume.contact?.linkedin?.trim();
  if (linkedin) {
    const isUrl = /^https?:\/\/(www\.)?linkedin\.com\//i.test(linkedin) || linkedin.startsWith("linkedin.com/");
    if (!isUrl && !linkedin.startsWith("in/")) {
      score -= 1;
      findings.push({
        id: "ready-linkedin-format",
        category_key: "application_readiness",
        severity: "info",
        title: "LinkedIn profile link may not be formatted as a standard URL",
        detail: "Recruiters frequently click LinkedIn links from PDF headers. Ensure it begins with linkedin.com/in/...",
        fix_text: "Format LinkedIn URL as 'linkedin.com/in/your-profile'.",
        resume_location: "Contact details",
      });
    }
  }

  // 3. Referees Completeness (Max 3 pts)
  const referees = resume.referees ?? [];
  if (referees.length === 0) {
    score -= 1;
    findings.push({
      id: "ready-referees-empty",
      category_key: "application_readiness",
      severity: "info",
      title: "No referee section provided",
      detail: "While 'Available upon request' is common, having 2 verified professional referees speeds up the final offer stage.",
      fix_text: "Add 2 recent referees or maintain them ready for reference check requests.",
      resume_location: "Referees",
    });
  } else if (referees.length < 2) {
    findings.push({
      id: "ready-referees-single",
      category_key: "application_readiness",
      severity: "info",
      title: "Only 1 referee listed",
      detail: "Most Australian employers require at least 2 direct manager or supervisor references.",
      fix_text: "Add a second referee to satisfy standard hiring prerequisites.",
      resume_location: "Referees",
    });
  }

  // 4. Duplicate / Redundant Bullets (Max 4 pts)
  const expBullets = (resume.experience ?? []).flatMap((entry, entryIndex) =>
    (entry.bullets ?? []).map((bullet, bulletIndex) => ({
      bullet: bullet.trim(),
      entryIndex,
      bulletIndex,
      roleTitle: entry.job_title || "Role",
    }))
  ).filter((b) => b.bullet);

  const seen: Array<{ text: string; words: Set<string>; roleTitle: string; entryIndex: number; bulletIndex: number }> = [];
  let duplicateCount = 0;

  for (const item of expBullets) {
    const words = new Set(significantWords(item.bullet));
    const near = seen.find((s) => {
      const overlap = [...words].filter((w) => s.words.has(w)).length;
      const union = new Set([...words, ...s.words]).size;
      return union > 0 && overlap / union > 0.8;
    });

    if (near) {
      duplicateCount++;
      findings.push({
        id: `ready-duplicate-bullet-${item.entryIndex}-${item.bulletIndex}`,
        category_key: "application_readiness",
        severity: "warning",
        title: "Near-duplicate bullet detected across roles",
        detail: `The bullet in "${item.roleTitle}" repeats phrasing already used in "${near.roleTitle}".`,
        fix_text: "Differentiate this achievement or replace it with a unique project/win from this specific role.",
        resume_location: `${item.roleTitle} @ bullet ${item.bulletIndex + 1}`,
        bullet_text: item.bullet,
        target: { kind: "experienceBullet", index: item.entryIndex, bulletIndex: item.bulletIndex },
      });
    } else {
      seen.push({ text: item.bullet, words, roleTitle: item.roleTitle, entryIndex: item.entryIndex, bulletIndex: item.bulletIndex });
    }
  }

  if (duplicateCount > 0) {
    score -= Math.min(4, duplicateCount * 2);
  }

  // 5. Metric Repetition between Summary & Experience
  const summary = resume.summary ?? "";
  const summaryMetrics = Array.from(summary.matchAll(/(\d+\s*[%$kM]|reduced\s+[\w\s]+by\s+\d+%\b)/gi)).map((m) => m[0].toLowerCase());
  if (summaryMetrics.length > 0) {
    for (const metric of summaryMetrics) {
      const matchBullet = expBullets.find((b) => b.bullet.toLowerCase().includes(metric));
      if (matchBullet) {
        score = Math.max(0, score - 1);
        findings.push({
          id: `ready-metric-duplication-${matchBullet.entryIndex}-${matchBullet.bulletIndex}`,
          category_key: "application_readiness",
          severity: "info",
          title: `Metric "${metric}" repeated word-for-word`,
          detail: "The executive summary and experience bullet share the exact same metric verbatim. Vary the framing for stronger impact.",
          fix_text: "Frame the summary around overall career scope and reserve exact metric detail for the role bullet.",
          resume_location: `${matchBullet.roleTitle}`,
          bullet_text: matchBullet.bullet,
          target: { kind: "experienceBullet", index: matchBullet.entryIndex, bulletIndex: matchBullet.bulletIndex },
        });
      }
    }
  }

  return {
    score: Math.max(0, Math.min(MAX_READINESS_POINTS, score)),
    maxPoints: MAX_READINESS_POINTS,
    findings,
  };
}
