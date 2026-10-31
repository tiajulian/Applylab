import type { ResumeContact, ResumeContent, UserProfile } from "@/types";
import {
  asEducation,
  asExperience,
  asProjects,
  asRecord,
  asReferees,
  asString,
  asStringArray,
  MAX_LIST_ENTRIES,
  MAX_LONG_LEN,
  MAX_SKILLS,
} from "@/lib/profile/sanitizeProfileEntries";
import { formatEducationRange } from "@/lib/resume/formatDateRange";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { safeHttpUrl } from "@/lib/url/safeHttpUrl";

// Abuse bounds only - generous enough that no real resume reaches them.
const MAX_LINES_PER_ENTRY = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// A contact URL can legitimately exceed the short-text bound. Keep it whole or use the saved link.
function contactLinkOr(value: unknown, fallback?: string | null): string {
  const link = typeof value === "string" ? value.trim() : "";
  return safeHttpUrl(link) ? link : fallback ?? "";
}

/** The parse's email when it is one address, else "" - a model can copy a whole contact line. */
export function parsedEmail(value: unknown): string {
  const email = asString(value).trim();
  return EMAIL_PATTERN.test(email) ? email : "";
}

/** Lines as the file wrote them: blank ones dropped, each bounded like the profile's long text. */
function asLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    .slice(0, MAX_LINES_PER_ENTRY)
    .map((line) => line.trim().slice(0, MAX_LONG_LEN));
}

/** A role's or project's own lines; its description's lines when it has none. */
function entryLines(entry: Record<string, unknown>): string[] {
  const bullets = asLines(entry.bullets);
  return bullets.length > 0 ? bullets : asLines(asString(entry.description, MAX_LONG_LEN).split(/\r?\n/));
}

function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.slice(0, MAX_LIST_ENTRIES).map(asRecord) : [];
}

/**
 * An uploaded resume (already parsed by /api/profile/parse) as resume content, exactly as the file
 * wrote it: every line, in the file's order, nothing reworded or cut. The editor's reviewer then
 * suggests changes for the user to accept. Contact details the file lacks use `fallback`.
 */
export function uploadedResumeContent(imported: unknown, fallback: ResumeContact): ResumeContent {
  const source = asRecord(imported);
  const or = (value: unknown, fallbackValue: string) => asString(value).trim() || fallbackValue;

  return sanitizeResumeContent({
    contact: {
      name: or(source.fullName, fallback.name),
      email: parsedEmail(source.email) || fallback.email,
      phone: or(source.phone, fallback.phone),
      location: or(source.location, fallback.location),
      linkedin: or(source.linkedin_url, fallback.linkedin),
      portfolio: contactLinkOr(source.portfolio_url, fallback.portfolio),
      github: contactLinkOr(source.github_url, fallback.github),
      work_rights: or(source.work_rights, fallback.work_rights),
    },
    target_titles: asLines(source.target_titles),
    summary: asString(source.summary, MAX_LONG_LEN).trim(),
    skills: asLines(source.skills),
    tools: asLines(source.tools),
    experience: asList(source.work_experience).map((role) => ({
      job_title: asString(role.job_title),
      company: asString(role.company),
      company_description: "",
      location: asString(role.location),
      start_date: asString(role.start_date),
      end_date: role.is_current === true ? "Present" : asString(role.end_date),
      bullets: entryLines(role),
    })),
    projects: asList(source.projects)
      .map((project) => ({
        title: asString(project.title),
        context: asString(project.context),
        year: asString(project.timeframe),
        bullets: entryLines(project),
      }))
      .filter((project) => project.title.trim()),
    education: asEducation(source.education).map((edu) => ({
      degree: edu.degree,
      institution: edu.institution,
      year: formatEducationRange(edu),
      notes: edu.notes,
    })),
    referees: asReferees(source.referees),
    custom_sections: asList(source.other_sections).map((section) => ({
      title: asString(section.title).trim(),
      items: asLines(section.items),
    })),
  });
}

// What a parse's other sections become in the profile, which has no custom sections: a Languages
// section's languages are skills, and a Certifications/Licences/Courses section's lines are
// qualifications. Whole words only, so "Coursework" matches nothing. A heading matching no kind, or
// both ("Languages & Certifications"), stays on the resume only rather than being filed wrongly, as
// do Volunteering (its lines don't say where one role ends), Awards and Interests.
const HEADING_KINDS = {
  languages: /\blanguages?\b/i,
  qualifications: /\b(certificat\w*|licen[cs]\w*|qualifications?|courses?|training)\b/i,
};

function headingKind(title: string): keyof typeof HEADING_KINDS | null {
  const kinds = (Object.keys(HEADING_KINDS) as Array<keyof typeof HEADING_KINDS>).filter((kind) => HEADING_KINDS[kind].test(title));
  return kinds.length === 1 ? kinds[0] : null;
}

/** The profile's skills, projects and education from a parse, with its other sections filed in. */
export function profileListsFromParse(parsed: unknown): Pick<UserProfile, "skills" | "projects" | "education"> {
  const source = asRecord(parsed);
  const sections = asList(source.other_sections).map((section) => ({
    kind: headingKind(asString(section.title)),
    lines: asLines(section.items),
  }));
  const linesOf = (kind: keyof typeof HEADING_KINDS) => sections.filter((s) => s.kind === kind).flatMap((s) => s.lines);
  return {
    // Language lines are lists too ("English (native), Mandarin (fluent)"): split like tool lines.
    skills: skillsWithTools(asStringArray(source.skills), [...asStringArray(source.tools), ...linesOf("languages")]),
    projects: asProjects(source.projects),
    education: asEducation([
      ...asList(source.education),
      ...linesOf("qualifications").map((degree) => ({ degree, institution: "", start_date: "", end_date: "" })),
    ]),
  };
}

/**
 * A resume the user uploaded (already parsed by /api/profile/parse) shaped as the profile that
 * generation and the fact-checks read, so a general resume is written from that file alone.
 * Contact details the file lacks fall back to the saved profile - still the user's own facts -
 * and nothing else from the saved profile is mixed in.
 */
export function importedProfileToUserProfile(
  imported: unknown,
  stored: UserProfile | null,
  userId: string
): { profile: UserProfile; fullName: string } {
  const source = imported && typeof imported === "object" ? (imported as Record<string, unknown>) : {};
  const orStored = (value: unknown, fallback: string | null | undefined) => asString(value).trim() || fallback || null;

  return {
    fullName: asString(source.fullName).trim(),
    profile: {
      id: stored?.id ?? "",
      user_id: userId,
      career_goal: null,
      target_role: null,
      job_hunt_pain: null,
      work_rights: orStored(source.work_rights, stored?.work_rights),
      phone: orStored(source.phone, stored?.phone),
      location: orStored(source.location, stored?.location),
      linkedin_url: orStored(source.linkedin_url, stored?.linkedin_url),
      portfolio_url: contactLinkOr(source.portfolio_url, stored?.portfolio_url) || null,
      github_url: contactLinkOr(source.github_url, stored?.github_url) || null,
      work_experience: asExperience(source.work_experience),
      ...profileListsFromParse(source),
      tools: [],
      stakeholders: [],
      referees: asReferees(source.referees),
      raw_linkedin_paste: null,
      updated_at: new Date().toISOString(),
    },
  };
}

/**
 * A tools line's names. A list splits on , ; | (never inside brackets, so "Microsoft Office (Word,
 * Excel)" stays whole) and drops a leading "Category:" label; a line with no list, like
 * "Salesforce: advanced", is kept as written.
 */
function toolNames(line: string): string[] {
  const parts = [""];
  let depth = 0;
  for (const char of line) {
    if (char === "(" || char === "[") depth++;
    else if ((char === ")" || char === "]") && depth > 0) depth--;
    if (depth === 0 && /[,;|]/.test(char)) parts.push("");
    else parts[parts.length - 1] += char;
  }
  if (parts.length > 1) parts[0] = parts[0].replace(/^[^:(]*:/, "");
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * A parse's skills plus the tool names from its tools lines ("Data analysis: SQL, Python" gives
 * "SQL" and "Python"), for profile-shaped consumers, which keep software in `skills`. Each name once.
 */
export function skillsWithTools(skills: string[], toolLines: string[]): string[] {
  const names = toolLines.flatMap(toolNames);
  const seen = new Set<string>();
  return [...skills, ...names].filter((name) => {
    const key = norm(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_SKILLS);
}

/** True when a parsed upload has enough in it to write a resume from. */
export function hasResumeContent(
  profile: Pick<UserProfile, "work_experience" | "education" | "skills" | "projects">
): boolean {
  return [profile.work_experience, profile.education, profile.skills, profile.projects].some((list) => list.length > 0);
}

const FILLABLE_TEXT = ["work_rights", "phone", "location", "linkedin_url", "portfolio_url", "github_url"] as const;


/** Saved entries first, then the imported ones whose key isn't already there, up to `max`. */
function appendNew<T>(saved: T[] | undefined, incoming: T[], key: (entry: T) => string, max: number): T[] | null {
  const list = saved ?? [];
  const seen = new Set(list.map(key));
  const added = incoming.filter((entry) => {
    const k = key(entry);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return added.length > 0 ? [...list, ...added].slice(0, Math.max(max, list.length)) : null;
}

/**
 * What an upload adds to the saved profile: contact details where the profile has none, and any
 * role, qualification, project, referee or skill it doesn't have yet. Nothing saved is changed or
 * removed. Keeps the editor's later fact re-checks (which read the saved profile) able to find
 * everything the resume was written from. Null when the file adds nothing.
 */
export function profileAdditionsFrom(imported: UserProfile, stored: UserProfile | null): Partial<UserProfile> | null {
  const additions: Partial<UserProfile> = {};
  for (const key of FILLABLE_TEXT) {
    if (!stored?.[key]?.trim() && imported[key]) additions[key] = imported[key];
  }

  const lists = {
    skills: appendNew(stored?.skills, imported.skills, norm, MAX_SKILLS),
    work_experience: appendNew(
      stored?.work_experience,
      imported.work_experience,
      (e) => (norm(e.job_title) || norm(e.company) ? `${norm(e.job_title)}|${norm(e.company)}` : ""),
      MAX_LIST_ENTRIES
    ),
    education: appendNew(
      stored?.education,
      imported.education,
      (e) => (norm(e.degree) || norm(e.institution) ? `${norm(e.degree)}|${norm(e.institution)}` : ""),
      MAX_LIST_ENTRIES
    ),
    projects: appendNew(stored?.projects, imported.projects, (p) => norm(p.title), MAX_LIST_ENTRIES),
    referees: appendNew(stored?.referees, imported.referees, (r) => norm(r.name), MAX_LIST_ENTRIES),
  };
  for (const [key, merged] of Object.entries(lists)) {
    if (merged) Object.assign(additions, { [key]: merged });
  }

  return Object.keys(additions).length > 0 ? additions : null;
}
