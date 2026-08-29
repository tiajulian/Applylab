import type { FactCheckTarget, ResumeContent, ResumeReviewFinding } from "@/types";

export interface StructureCheckResult {
  score: number;
  maxPoints: number;
  findings: ResumeReviewFinding[];
}

export const MAX_STRUCTURE_POINTS = 20;

/**
 * Deterministic evaluation of ATS parseability and resume structural integrity.
 * Checks contact fields, standard sections, role header completeness, and date parseability.
 */
export function checkResumeStructure(resume: ResumeContent): StructureCheckResult {
  const findings: ResumeReviewFinding[] = [];
  let score = MAX_STRUCTURE_POINTS;

  // 1. Contact Field Completeness (Max 8 pts)
  const contact = resume.contact || ({} as Partial<ResumeContent["contact"]>);
  const hasName = Boolean(contact.name?.trim());
  const hasEmail = Boolean(contact.email?.trim() && contact.email.includes("@"));
  const hasPhone = Boolean(contact.phone?.trim());
  const hasLocation = Boolean(contact.location?.trim());
  const hasWorkRights = Boolean(contact.work_rights?.trim());

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
      detail: "Many Australian ATS filters automatically filter by city or state (e.g. Melbourne, VIC or Sydney, NSW).",
      fix_text: "Add your city and state to avoid location-based auto-filtering.",
      resume_location: "Contact details",
    });
  }

  if (!hasWorkRights) {
    score -= 1;
    findings.push({
      id: "struct-missing-work-rights",
      category_key: "ats_structure",
      severity: "info",
      title: "Australian work rights not specified",
      detail: "Clarifying Australian Citizen, Permanent Resident, or Visa status helps recruiters immediately confirm eligibility.",
      fix_text: "Add your work eligibility status to your contact header.",
      resume_location: "Contact details",
    });
  }

  // 2. Section Structure & Organization (Max 8 pts)
  const hasSummary = Boolean(resume.summary?.trim());
  const hasExperience = Array.isArray(resume.experience) && resume.experience.length > 0;
  const hasEducation = Array.isArray(resume.education) && resume.education.length > 0;
  const hasSkills = Array.isArray(resume.skills) && resume.skills.length > 0;

  if (!hasExperience) {
    score -= 4;
    findings.push({
      id: "struct-missing-experience",
      category_key: "ats_structure",
      severity: "hard_fail",
      title: "No work experience section found",
      detail: "Work experience is the most heavily weighted section parsed by applicant tracking software.",
      fix_text: "Add at least one professional role with title, employer, dates, and bulleted achievements.",
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

  if (!hasEducation) {
    score -= 1;
    findings.push({
      id: "struct-missing-education",
      category_key: "ats_structure",
      severity: "info",
      title: "No formal education or qualifications listed",
      detail: "Listing degrees, diplomas, or relevant professional certifications satisfies minimum qualification parser checks.",
      fix_text: "Add your highest level of education, diploma, or certification.",
      resume_location: "Education",
    });
  }

  if (!hasSummary) {
    score -= 1;
    findings.push({
      id: "struct-missing-summary",
      category_key: "ats_structure",
      severity: "warning",
      title: "No professional summary",
      detail: "A concise 2-3 sentence summary positions your background and key strengths before the recruiter skims your roles.",
      fix_text: "Add a crisp executive summary positioning your career level and core competencies.",
      resume_location: "Professional summary",
      target: { kind: "summary" },
    });
  }

  // 3. Role Completeness & Date Formatting (Max 4 pts)
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
