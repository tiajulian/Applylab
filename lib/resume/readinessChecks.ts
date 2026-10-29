import type { ResumeContent, ResumeReviewFinding } from "@/types";
import { analyzeResume } from "./contentChecks";
import { checkResumeIntegrity } from "./integrityChecks";

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
 * Checks unfinished entries, links and repeated bullets. Estimated document length is advice
 * only; missing referees and repeating a headline achievement do not cost points.
 */
export function checkApplicationReadiness(resume: ResumeContent): ReadinessCheckResult {
  const findings: ResumeReviewFinding[] = [];
  let score = MAX_READINESS_POINTS;

  const analysis = analyzeResume(resume);

  // Document length is advice only; the estimate cannot establish the actual page count.
  if (analysis.estimatedPages > 3) {
    findings.push({
      id: "ready-length-excessive",
      category_key: "application_readiness",
      severity: "info",
      title: "Check the document length",
      detail: "The word count suggests a longer resume. This is an estimate, not a measurement of your PDF. Suitable length depends on your experience and the employer's instructions.",
      fix_text: "Follow any advertised page limit and keep relevant evidence easy to find. You do not need to remove useful content just to reach two pages.",
      resume_location: "Full document",
    });
  }

  // Link hygiene.
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

  // Duplicate / redundant bullets (max 4 points).
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

  // Unfinished or inconsistent entries (placeholders, missing dates, duplicates, chronology...).
  const integrity = checkResumeIntegrity(resume);
  findings.push(...integrity);
  score -= Math.min(6, integrity.filter((f) => f.severity === "warning").length);

  return {
    score: Math.max(0, Math.min(MAX_READINESS_POINTS, score)),
    maxPoints: MAX_READINESS_POINTS,
    findings,
  };
}
