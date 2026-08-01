import type {
  ResumeContact,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
} from "@/types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asRecord(entry: unknown): Record<string, unknown> {
  return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
}

function sanitizeContact(value: unknown): ResumeContact {
  const record = asRecord(value);
  return {
    name: asString(record.name),
    phone: asString(record.phone),
    email: asString(record.email),
    location: asString(record.location),
    linkedin: asString(record.linkedin),
    work_rights: asString(record.work_rights),
  };
}

function sanitizeExperience(value: unknown): ResumeExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      job_title: asString(entry.job_title),
      company: asString(entry.company),
      company_description: asString(entry.company_description),
      location: asString(entry.location),
      start_date: asString(entry.start_date),
      end_date: asString(entry.end_date),
      bullets: asStringArray(entry.bullets),
    };
  });
}

function sanitizeEducation(value: unknown): ResumeEducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      degree: asString(entry.degree),
      institution: asString(entry.institution),
      year: asString(entry.year),
      notes: asString(entry.notes),
    };
  });
}

function sanitizeReferees(value: unknown): ResumeReferee[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      name: asString(entry.name),
      title: asString(entry.title),
      organisation: asString(entry.organisation),
      phone: asString(entry.phone),
      email: asString(entry.email),
    };
  });
}

function sanitizeProjects(value: unknown): ResumeProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      title: asString(entry.title),
      context: asString(entry.context),
      year: asString(entry.year),
      bullets: asStringArray(entry.bullets),
    };
  });
}

/**
 * Normalizes a resume_content value (from a client request body, or a DB row that predates a
 * ResumeContent schema change) into the current ResumeContent shape, filling in any missing
 * field with its empty default rather than leaving it undefined.
 *
 * This matters beyond input validation: resume_content is stored as jsonb, so a row written
 * before target_titles/tools/projects existed simply doesn't have those keys - the TS type says
 * they're required, but nothing enforces that against what's actually sitting in the database.
 * Every read site that hands resume_content to a template/export/scoring function needs to run
 * it through here first, or an old resume crashes the page the moment something does
 * `.target_titles.length` / `.tools.map` / `.projects.length` on a value that's actually
 * undefined. See lib/resume/sanitizeResumeContent.test.ts for the regression this guards.
 */
export function sanitizeResumeContent(value: unknown): ResumeContent {
  const record = asRecord(value);
  return {
    contact: sanitizeContact(record.contact),
    target_titles: asStringArray(record.target_titles),
    summary: asString(record.summary),
    skills: asStringArray(record.skills),
    tools: asStringArray(record.tools),
    experience: sanitizeExperience(record.experience),
    projects: sanitizeProjects(record.projects),
    education: sanitizeEducation(record.education),
    referees: sanitizeReferees(record.referees),
  };
}
