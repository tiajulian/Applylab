import { currentAwareEndDate, parseRoleDate } from "@/lib/profile/parseRoleDate";
import { capitalizeWords } from "@/lib/text/capitalizeWords";
import { formatEducationRange } from "@/lib/resume/formatDateRange";
import { normalizeProfile } from "@/lib/profile/normalizeProfile";
import type {
  EducationEntry,
  ProjectEntry,
  RefereeEntry,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
  UserProfile,
  WorkExperienceEntry,
} from "@/types";

/** The resume sections the editor's Add pop-up covers - each has several fields per item and a
 * matching list on the profile to pick from. One-line items (bullets, skills, tools) stay inline. */
export type AddSection = "experience" | "projects" | "education" | "referees";

/** The profile lists the Add pop-up reads from, keyed by profile column. */
export type ProfileLibrary = Pick<UserProfile, "work_experience" | "projects" | "education" | "referees">;
export type ProfileEntrySection = keyof ProfileLibrary;

export const PROFILE_SECTION_FOR: Record<AddSection, ProfileEntrySection> = {
  experience: "work_experience",
  projects: "projects",
  education: "education",
  referees: "referees",
};

/** A profile-shaped entry for each section - both what the "From my profile" tab lists and what
 * the "New" form builds, so a hand-typed role and a saved one take the same path onto the resume. */
export interface ProfileEntryFor {
  experience: WorkExperienceEntry;
  projects: ProjectEntry;
  education: EducationEntry;
  referees: RefereeEntry;
}

/** A blank entry per section - the "New" form's starting point, and the defaults a stored entry
 * missing newer fields is filled from. */
export const EMPTY_PROFILE_ENTRY: { [S in AddSection]: () => ProfileEntryFor[S] } = {
  experience: () => ({ job_title: "", company: "", location: "", start_date: "", end_date: "", is_current: false, description: "", wins: [] }),
  projects: () => ({ title: "", description: "", context: "", timeframe: "", tools: [], link: "", outcome: "", outcome_metric: "" }),
  education: () => ({ degree: "", institution: "", start_date: "", end_date: "", is_current: false, notes: "" }),
  referees: () => ({ name: "", title: "", organisation: "", phone: "", email: "" }),
};

/** Stored entries over their blank defaults, nulls dropped - jsonb rows from older saves can lack
 * newer fields or hold null where a string is expected. */
function withDefaults<T extends object>(empty: () => T, list: unknown): T[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({ ...empty(), ...Object.fromEntries(Object.entries(entry).filter(([, value]) => value != null)) }) as T);
}

/** The profile lists the Add pop-up offers, read through the same migrations every server-side
 * profile reader applies (normalizeProfile) - roles newest first. */
export function toProfileLibrary(row: Partial<UserProfile> | null): ProfileLibrary {
  const { workExperience, education } = normalizeProfile(row as UserProfile | null);
  return {
    work_experience: withDefaults(EMPTY_PROFILE_ENTRY.experience, workExperience),
    projects: withDefaults(EMPTY_PROFILE_ENTRY.projects, row?.projects),
    education: withDefaults(EMPTY_PROFILE_ENTRY.education, education),
    referees: withDefaults(EMPTY_PROFILE_ENTRY.referees, row?.referees),
  };
}

const norm = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "");

/** Lines of free text ("• did x\n- did y") as bullets, list markers dropped. */
function linesOf(text: string): string[] {
  return text
    .split(/\r?\n|•/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

// The converters below write entries exactly as generation does (lib/anthropic/generateResume.ts):
// capitalised names, profile dates as stored, "Current" for an ongoing role or qualification - so an
// added entry can't be told apart from a generated one.

export function experienceFromProfile(entry: WorkExperienceEntry): ResumeExperienceEntry {
  // The candidate's own wins first; otherwise their own notes about the role. Never filler - a role
  // with neither arrives with no bullets, and the canvas offers Suggest tasks for it.
  const wins = (entry.wins ?? []).map((win) => win.text.trim()).filter(Boolean);
  return {
    job_title: capitalizeWords(entry.job_title.trim()),
    company: capitalizeWords(entry.company.trim()),
    company_description: "",
    location: capitalizeWords(entry.location.trim()),
    start_date: entry.start_date.trim(),
    end_date: currentAwareEndDate(entry).trim(),
    bullets: wins.length > 0 ? wins : linesOf(entry.description ?? ""),
  };
}

export function projectFromProfile(proj: ProjectEntry): ResumeProjectEntry {
  const bullets = linesOf(proj.description ?? "");
  if (proj.outcome?.trim()) {
    bullets.push(proj.outcome_metric?.trim() ? `${proj.outcome.trim()} (${proj.outcome_metric.trim()})` : proj.outcome.trim());
  } else if (proj.outcome_metric?.trim()) {
    bullets.push(proj.outcome_metric.trim());
  }
  if (proj.link?.trim()) bullets.push(`Project link: ${proj.link.trim()}`);
  return {
    title: proj.title.trim(),
    context: [proj.context?.trim(), (proj.tools ?? []).map((tool) => tool.trim()).filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    year: proj.timeframe?.trim() ?? "",
    bullets,
  };
}

export function educationFromProfile(edu: EducationEntry): ResumeEducationEntry {
  return {
    degree: capitalizeWords(edu.degree.trim()),
    institution: capitalizeWords(edu.institution.trim()),
    year: formatEducationRange(edu),
    notes: edu.notes?.trim() ?? "",
  };
}

export function refereeFromProfile(ref: RefereeEntry): ResumeReferee {
  return {
    name: ref.name.trim(),
    title: capitalizeWords(ref.title.trim()),
    organisation: capitalizeWords(ref.organisation.trim()),
    phone: ref.phone.trim(),
    email: ref.email.trim(),
  };
}

/** Identity of an entry for "already there?" checks - the same for a profile entry and its resume
 * copy (the fields both shapes share), so the pop-up can mark what's already on the resume and the
 * save endpoint can skip a duplicate. */
export function profileEntryKey(section: ProfileEntrySection, entry: Record<string, unknown>): string {
  switch (section) {
    case "work_experience":
      return `${norm(entry.job_title)}|${norm(entry.company)}`;
    case "projects":
      return norm(entry.title);
    case "education":
      return `${norm(entry.degree)}|${norm(entry.institution)}`;
    case "referees":
      return norm(entry.name);
  }
}

/** Keys of everything already in this resume section. */
export function resumeEntryKeys(resume: ResumeContent, section: AddSection): Set<string> {
  const profileSection = PROFILE_SECTION_FOR[section];
  const list = resume[section] as unknown as Record<string, unknown>[];
  return new Set(list.map((entry) => profileEntryKey(profileSection, entry)));
}

/** The later end of a date or range ("2019 - 2021" -> 2021, "2024 - Present" -> now). */
function latestDate(text: string, fallbackMonth: number): number | null {
  const parts = text.split(/\s+(?:[-–—]|to)\s+/i);
  return parseRoleDate(parts[parts.length - 1], fallbackMonth) ?? parseRoleDate(text, fallbackMonth);
}

type Recency = [end: number, start: number] | null;

/** A dated entry's place in a newest-first list: its end (Present counts as now), else its start;
 * ties (two current roles) go to the later start. */
function recency(end: string, start: string): Recency {
  const startValue = latestDate(start, 0);
  const endValue = latestDate(end, 11) ?? startValue;
  return endValue === null ? null : [endValue, startValue ?? endValue];
}

const isNewer = (a: NonNullable<Recency>, b: NonNullable<Recency>) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

/** Where a new dated entry goes in a newest-first list: before the first entry it's newer than.
 * An undated entry goes first, where "+ Add" always put it, so it's in view to fill in. */
function insertionIndex(existing: Recency[], incoming: Recency): number {
  if (incoming === null) return 0;
  const index = existing.findIndex((value) => value !== null && isNewer(incoming, value));
  return index === -1 ? existing.length : index;
}

function insertAt<T>(list: T[], index: number, item: T): T[] {
  return [...list.slice(0, index), item, ...list.slice(index)];
}

/**
 * Adds profile-shaped entries to the resume - converted, and each placed by date (newest first)
 * for roles, projects and qualifications; referees go at the end. Returns the new resume and the
 * index the first added entry ended up at, so the canvas can scroll to it and select it.
 */
export function addEntriesToResume<S extends AddSection>(
  resume: ResumeContent,
  section: S,
  entries: ProfileEntryFor[S][]
): { resume: ResumeContent; firstIndex: number } {
  let next = resume;
  const placed: number[] = [];
  for (const entry of entries) {
    let index: number;
    switch (section) {
      case "experience": {
        const item = experienceFromProfile(entry as WorkExperienceEntry);
        index = insertionIndex(next.experience.map((e) => recency(e.end_date, e.start_date)), recency(item.end_date, item.start_date));
        next = { ...next, experience: insertAt(next.experience, index, item) };
        break;
      }
      case "projects": {
        const item = projectFromProfile(entry as ProjectEntry);
        index = insertionIndex(next.projects.map((p) => recency(p.year, "")), recency(item.year, ""));
        next = { ...next, projects: insertAt(next.projects, index, item) };
        break;
      }
      case "education": {
        const item = educationFromProfile(entry as EducationEntry);
        index = insertionIndex(next.education.map((e) => recency(e.year, "")), recency(item.year, ""));
        next = { ...next, education: insertAt(next.education, index, item) };
        break;
      }
      default: {
        const item = refereeFromProfile(entry as RefereeEntry);
        index = next.referees.length;
        next = { ...next, referees: [...next.referees, item] };
      }
    }
    // An earlier pick that sat at or after this one has shifted down by one.
    for (let i = 0; i < placed.length; i++) if (placed[i] >= index) placed[i] += 1;
    placed.push(index);
  }
  return { resume: next, firstIndex: placed.length > 0 ? Math.min(...placed) : 0 };
}
