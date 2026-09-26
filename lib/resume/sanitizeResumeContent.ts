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

/** True when every field on a sanitized entry is blank (empty string) or an empty array - the
 * shape an "Add role"/"Add project"/etc. button always creates (see resumeFieldUpdaters.ts's
 * EMPTY_EXPERIENCE and its siblings), before anything has been typed into it. Every repeatable
 * section's "Add" button prepends or appends one of these with no separate "edit" affordance
 * nearby, so it's easy to click by mistake (e.g. reaching for it to fix a typo in an existing
 * entry) and never notice the abandoned blank one left behind - reported as a resume showing a
 * fully-empty duplicate role immediately next to the real, complete one. Dropping these here (the
 * one place every save/export/read path already funnels resume_content through) neutralizes that
 * failure mode regardless of which UI flow produced the orphaned entry, without needing to change
 * the "Add" buttons themselves or touch the user's own in-progress editing session (this never
 * runs against the live client-side reducer state, only server-side save/read/export). */
function isFullyBlank(entry: Record<string, unknown>): boolean {
  return Object.values(entry).every((field) => (Array.isArray(field) ? field.length === 0 : field === ""));
}

export function sanitizeLinkedinUrl(input: unknown): string {
  const raw = asString(input).trim();
  if (!raw) return "";

  // Strip query params, tracking parameters (e.g. ?ref=xyz, ?utm_source=...), and hash fragments
  let clean = raw.split("?")[0].split("#")[0].trim();

  // Strip trailing slashes
  clean = clean.replace(/\/+$/, "");

  // Strip machine IDs / hash suffixes e.g. -861a86182 or -861a86
  clean = clean.replace(/-(?:[a-f0-9]{8,12}|[0-9]{6,12})$/i, "");

  // Format as clean vanity URL
  if (clean.includes("linkedin.com/in/")) {
    const parts = clean.split("linkedin.com/in/");
    return `linkedin.com/in/${parts[1]}`;
  }
  if (clean.startsWith("in/")) {
    return `linkedin.com/${clean}`;
  }
  return clean;
}

export function sanitizePhoneNumber(input: unknown): string {
  const raw = asString(input).trim();
  if (!raw) return "";
  // Keep digits, +, hyphens, spaces, parentheses; strip unprintable unicode
  return raw.replace(/[^\d+()\s-]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizeContact(value: unknown): ResumeContact {
  const record = asRecord(value);
  return {
    name: asString(record.name),
    phone: sanitizePhoneNumber(record.phone),
    email: asString(record.email),
    location: asString(record.location),
    linkedin: sanitizeLinkedinUrl(record.linkedin),
    work_rights: asString(record.work_rights),
  };
}

function sanitizeExperience(value: unknown): ResumeExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
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
    })
    .filter((entry) => !isFullyBlank(entry));
}

function sanitizeEducation(value: unknown): ResumeEducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const entry = asRecord(raw);
      return {
        degree: asString(entry.degree),
        institution: asString(entry.institution),
        year: asString(entry.year),
        notes: asString(entry.notes),
      };
    })
    .filter((entry) => !isFullyBlank(entry));
}

function sanitizeReferees(value: unknown): ResumeReferee[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const entry = asRecord(raw);
      return {
        name: asString(entry.name),
        title: asString(entry.title),
        organisation: asString(entry.organisation),
        phone: asString(entry.phone),
        email: asString(entry.email),
      };
    })
    .filter((entry) => !isFullyBlank(entry));
}

function sanitizeProjects(value: unknown): ResumeProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const entry = asRecord(raw);
      return {
        title: asString(entry.title),
        context: asString(entry.context),
        year: asString(entry.year),
        bullets: asStringArray(entry.bullets),
      };
    })
    .filter((entry) => !isFullyBlank(entry));
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
