import type { UserProfile } from "@/types";
import {
  asEducation,
  asExperience,
  asProjects,
  asReferees,
  asString,
  asStringArray,
  MAX_LIST_ENTRIES,
  MAX_SKILLS,
} from "@/lib/profile/sanitizeProfileEntries";

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
      work_experience: asExperience(source.work_experience),
      projects: asProjects(source.projects),
      education: asEducation(source.education),
      skills: asStringArray(source.skills),
      tools: [],
      stakeholders: [],
      referees: asReferees(source.referees),
      raw_linkedin_paste: null,
      updated_at: new Date().toISOString(),
    },
  };
}

/** True when a parsed upload has enough in it to write a resume from. */
export function hasResumeContent(
  profile: Pick<UserProfile, "work_experience" | "education" | "skills" | "projects">
): boolean {
  return [profile.work_experience, profile.education, profile.skills, profile.projects].some((list) => list.length > 0);
}

const FILLABLE_TEXT = ["work_rights", "phone", "location", "linkedin_url"] as const;

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

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
