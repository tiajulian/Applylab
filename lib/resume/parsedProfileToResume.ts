import type {
  ParsedProfileFields,
  ResumeContact,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
} from "@/types";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";

/**
 * Converts parsed profile fields (from an uploaded resume / raw text) into
 * a canonical ResumeContent structure for the scoring engine.
 */
export function parsedProfileToResumeContent(
  parsed: ParsedProfileFields,
  rawText: string = ""
): ResumeContent {
  // Extract email via regex if missing from parsed.fullName/contact
  let email = "";
  const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0].trim();
  }

  const contact: ResumeContact = {
    name: parsed.fullName?.trim() || "",
    email,
    phone: parsed.phone?.trim() || "",
    location: parsed.location?.trim() || "",
    linkedin: parsed.linkedin_url?.trim() || "",
    work_rights: parsed.work_rights?.trim() || "",
  };

  const experience: ResumeExperienceEntry[] = (parsed.work_experience || []).map((exp) => {
    const bullets: string[] = [];

    if (exp.wins && Array.isArray(exp.wins)) {
      for (const win of exp.wins) {
        if (win && win.text) {
          bullets.push(win.text.trim());
        }
      }
    }

    if (bullets.length === 0 && exp.description) {
      const splitLines = exp.description
        .split(/\r?\n|•|-|\*/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (splitLines.length > 0) {
        bullets.push(...splitLines);
      } else {
        bullets.push(exp.description.trim());
      }
    }

    return {
      job_title: exp.job_title?.trim() || "Role",
      company: exp.company?.trim() || "Company",
      company_description: "",
      location: exp.location?.trim() || "",
      start_date: exp.start_date?.trim() || "",
      end_date: exp.is_current ? "Present" : exp.end_date?.trim() || "",
      bullets: bullets.length > 0 ? bullets : ["Responsible for key duties and operational deliverables."],
    };
  });

  const education: ResumeEducationEntry[] = (parsed.education || []).map((edu) => ({
    degree: edu.degree?.trim() || "",
    institution: edu.institution?.trim() || "",
    year: edu.end_date?.trim() || edu.start_date?.trim() || "",
    notes: edu.notes?.trim() || "",
  }));

  const projects: ResumeProjectEntry[] = (parsed.projects || []).map((proj) => ({
    title: proj.title?.trim() || "",
    context: proj.context?.trim() || "",
    year: proj.timeframe?.trim() || "",
    bullets: proj.description ? [proj.description.trim()] : [],
  }));

  const referees: ResumeReferee[] = (parsed.referees || []).map((ref) => ({
    name: ref.name?.trim() || "",
    title: ref.title?.trim() || "",
    organisation: ref.organisation?.trim() || "",
    phone: ref.phone?.trim() || "",
    email: ref.email?.trim() || "",
  }));

  const rawResume: ResumeContent = {
    contact,
    target_titles: [],
    summary: "",
    skills: parsed.skills || [],
    tools: [],
    experience,
    projects,
    education,
    referees,
  };

  return sanitizeResumeContent(rawResume);
}
