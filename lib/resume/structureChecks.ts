import type { FactCheckTarget, ResumeContent, ResumeReviewFinding } from "@/types";

export interface StructureCheckResult {
  score: number;
  maxPoints: number;
  findings: ResumeReviewFinding[];
}

export const MAX_STRUCTURE_POINTS = 20;

/**
 * Checks contact details, evidence sections and role completeness. These are content checks,
 * not a test of whether the original uploaded file can be parsed by a hiring system.
 */
export function checkResumeStructure(resume: ResumeContent): StructureCheckResult {
  const findings: ResumeReviewFinding[] = [];
  let score = MAX_STRUCTURE_POINTS;

  // Contact details.
  const contact = resume.contact || ({} as Partial<ResumeContent["contact"]>);
  const hasName = Boolean(contact.name?.trim());
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email?.trim() ?? "");
  const hasPhone = Boolean(contact.phone?.trim());
  const hasLocation = Boolean(contact.location?.trim());

  if (!hasName) {
    score -= 3;
    findings.push({
      id: "struct-missing-name",
      category_key: "ats_structure",
      severity: "hard_fail",
      title: "Missing candidate name",
      detail: "ATS parsers require a clear header name to index and match your candidate profile.",
      fix_text: "Add your full name to your contact details header.",
      resume_location: "Contact details",
    });
  }

  if (!hasEmail) {
    score -= 2;
    findings.push({
      id: "struct-missing-email",
      category_key: "ats_structure",
      severity: "hard_fail",
      title: "Missing or invalid email address",
      detail: "Recruiters and automated hiring systems rely on email as the primary unique applicant identifier.",
      fix_text: "Add a valid personal email address (e.g. name@domain.com).",
      resume_location: "Contact details",
    });
  }

  if (!hasPhone) {
    score -= 1;
    findings.push({
      id: "struct-missing-phone",
      category_key: "ats_structure",
      severity: "warning",
      title: "Missing contact phone number",
      detail: "Recruiters frequently screen candidates via phone before scheduling formal interviews.",
      fix_text: "Add an Australian mobile number (e.g. +61 4XX XXX XXX).",
      resume_location: "Contact details",
    });
  }

  if (!hasLocation) {
    score -= 1;
    findings.push({
      id: "struct-missing-location",
      category_key: "ats_structure",
      severity: "warning",
      title: "Missing location",
      detail: "Your city and state help a recruiter understand where you are based. A full street address is not needed.",
      fix_text: "Add your city and state if relevant to the roles you are seeking.",
      resume_location: "Contact details",
    });
  }

  // Sections and evidence.
  const hasSummary = Boolean(resume.summary?.trim());
  const hasExperience = Array.isArray(resume.experience) && resume.experience.length > 0;
  const hasSkills = Array.isArray(resume.skills) && resume.skills.length > 0;

  const hasOtherEvidence = resume.projects?.some((p) => p.bullets?.some((b) => b.trim()))
    || resume.custom_sections?.some((s) => s.items.some((item) => item.trim()));
  if (!hasExperience && !hasOtherEvidence) {
    score -= 2;
    findings.push({
      id: "struct-missing-experience",
      category_key: "ats_structure",
      severity: "warning",
      title: "Add an example of your work",
      detail: "A job, placement, project or volunteer role can help show what you can do, even if you are applying for your first job.",
      fix_text: "Add a real example of your work, including what you did. Paid employment is not required.",
      resume_location: "Work experience",
    });
  }

  if (!hasSkills) {
    score -= 2;
    findings.push({
      id: "struct-missing-skills",
      category_key: "ats_structure",
      severity: "warning",
      title: "Missing key skills section",
      detail: "A dedicated Key Skills section provides ATS keyword scanners with an immediate high-density competency signal.",
      fix_text: "Add 4-8 core domain skills relevant to your target role.",
      resume_location: "Key skills",
    });
  }

  if (!hasSummary) {
    findings.push({
      id: "struct-missing-summary",
      category_key: "ats_structure",
      severity: "info",
      title: "Consider a short introduction",
      detail: "A concise 2-3 sentence summary positions your background and key strengths before the recruiter skims your roles.",
      fix_text: "If it helps explain your background, add two short sentences about your real experience and the work you want to do.",
      resume_location: "Professional summary",
      target: { kind: "summary" },
    });
  }

  // Role completeness (max 4 points).
  if (hasExperience) {
    let incompleteRoleCount = 0;
    resume.experience.forEach((role, i) => {
      const missingJobTitle = !role.job_title?.trim();
      const missingCompany = !role.company?.trim();
      const missingDates = !role.start_date?.trim();

      if (missingJobTitle || missingCompany || missingDates) {
        incompleteRoleCount++;
        const target: FactCheckTarget = {
          kind: "experienceHeader",
          index: i,
          field: missingJobTitle ? "job_title" : missingCompany ? "company" : "dates",
        };
        findings.push({
          id: `struct-role-${i}-incomplete`,
          category_key: "ats_structure",
          severity: "hard_fail",
          title: `Incomplete role details for ${role.job_title || role.company || `Role #${i + 1}`}`,
          detail: "ATS parsers fail to build a chronological employment history when title, employer, or dates are omitted.",
          fix_text: "Ensure job title, company name, and start/end dates are populated.",
          resume_location: `${role.job_title || "Role"} at ${role.company || "Company"}`,
          target,
        });
      }
    });

    if (incompleteRoleCount > 0) {
      score -= Math.min(4, incompleteRoleCount * 2);
    }
  }

  return {
    score: Math.max(0, Math.min(MAX_STRUCTURE_POINTS, score)),
    maxPoints: MAX_STRUCTURE_POINTS,
    findings,
  };
}
