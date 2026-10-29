import { factCheckTargetKey, type ResumeContent, type ResumeReviewFinding } from "@/types";

const PRIORITY = { hard_fail: 0, warning: 1, info: 2 };

export function topReviewFindings(findings: ResumeReviewFinding[]): ResumeReviewFinding[] {
  const sorted = findings.filter((f) => f.status !== "applied" && f.status !== "dismissed")
    .sort((a, b) => PRIORITY[a.severity] - PRIORITY[b.severity] || Number(Boolean(b.replacement)) - Number(Boolean(a.replacement)));
  const seen = new Set<string>();
  return sorted.filter((finding) => {
    const key = finding.target ? factCheckTargetKey(finding.target) : finding.bullet_text || finding.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

/** Observable facts only. Never infer achievements or promise hiring outcomes from a score. */
export function reviewStrengths(content: ResumeContent): string[] {
  const strengths: string[] = [];
  const contact = content.contact;
  if (contact.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) && contact.phone.trim()) {
    strengths.push("Your name, email and phone number are included.");
  }
  if (content.experience.length && content.experience.every((role) => role.job_title.trim() && role.company.trim() && role.start_date.trim() && role.end_date.trim())) {
    strengths.push("Your work history includes role titles, employers and dates.");
  }
  if (content.projects.some((project) => project.title.trim() && project.bullets.some((bullet) => bullet.trim()))) {
    strengths.push("Your projects include descriptions of your work.");
  }
  if (content.skills.some((skill) => skill.trim())) strengths.push("You have a dedicated list of skills.");
  return strengths.slice(0, 2);
}
