import type { EducationEntry, RefereeEntry, UserProfile, WorkExperienceEntry } from "@/types";

export type ScorableProfile = Pick<
  UserProfile,
  | "work_rights"
  | "phone"
  | "location"
  | "linkedin_url"
  | "work_experience"
  | "education"
  | "skills"
  | "referees"
  | "raw_linkedin_paste"
> & { fullName: string };

export type MvpFieldKey = "fullName" | "experience" | "skills" | "location" | "workRights";

export const MVP_FIELD_LABELS: Record<MvpFieldKey, string> = {
  fullName: "Full name",
  experience: "At least one work experience entry",
  skills: "At least 3 skills",
  location: "Location",
  workRights: "Work rights",
};

function nonEmpty(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

function isCompleteExperience(entry: WorkExperienceEntry): boolean {
  return nonEmpty(entry.job_title) && nonEmpty(entry.company) && nonEmpty(entry.description);
}

function isCompleteEducation(entry: EducationEntry): boolean {
  return nonEmpty(entry.degree) && nonEmpty(entry.institution);
}

export function getMissingMvpFields(profile: ScorableProfile): MvpFieldKey[] {
  const missing: MvpFieldKey[] = [];

  if (!nonEmpty(profile.fullName)) missing.push("fullName");
  if (!(profile.work_experience ?? []).some(isCompleteExperience)) missing.push("experience");
  if ((profile.skills ?? []).filter((s) => nonEmpty(s)).length < 3) missing.push("skills");
  if (!nonEmpty(profile.location)) missing.push("location");
  if (!nonEmpty(profile.work_rights)) missing.push("workRights");

  return missing;
}

export function meetsMVP(profile: ScorableProfile): boolean {
  return getMissingMvpFields(profile).length === 0;
}

/**
 * Human-readable suggestions for improving an already-MVP-complete profile, ordered by rough
 * impact (mirrors the weighting in computeCompleteness below). Used for the "Profile X% complete
 * — add ... for stronger results" banner copy — deliberately short (default cap 2) since it's a
 * one-line nudge, not a checklist.
 */
export function getImprovementSuggestions(profile: ScorableProfile, max = 2): string[] {
  const suggestions: string[] = [];

  const skillsCount = (profile.skills ?? []).filter(nonEmpty).length;
  if (skillsCount < 5) {
    const need = 5 - skillsCount;
    suggestions.push(`${need} more skill${need === 1 ? "" : "s"}`);
  }

  const completeExperienceCount = (profile.work_experience ?? []).filter(isCompleteExperience).length;
  if (completeExperienceCount < 3) {
    suggestions.push("another work experience entry");
  }

  if (!nonEmpty(profile.phone)) {
    suggestions.push("your phone number");
  }

  const completeEducationCount = (profile.education ?? []).filter(isCompleteEducation).length;
  if (completeEducationCount < 1) {
    suggestions.push("your education history");
  }

  if (!nonEmpty(profile.linkedin_url) && !nonEmpty(profile.raw_linkedin_paste)) {
    suggestions.push("your LinkedIn");
  }

  return suggestions.slice(0, max);
}

/** Joins suggestions into "your phone number and 2 more skills" / "your phone number" / "" (Oxford-comma-free). */
export function joinSuggestions(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  if (suggestions.length === 1) return suggestions[0];
  return `${suggestions.slice(0, -1).join(", ")} and ${suggestions[suggestions.length - 1]}`;
}

function scaled(count: number, cap: number, weight: number): number {
  return (Math.min(count, cap) / cap) * weight;
}

export function computeCompleteness(profile: ScorableProfile): number {
  const contactFilled = [profile.fullName, profile.phone, profile.location].filter(nonEmpty).length;
  const contactScore = (contactFilled / 3) * 15;

  const workRightsScore = nonEmpty(profile.work_rights) ? 10 : 0;

  const completeExperienceCount = (profile.work_experience ?? []).filter(isCompleteExperience).length;
  const experienceScore = scaled(completeExperienceCount, 3, 35);

  const completeEducationCount = (profile.education ?? []).filter(isCompleteEducation).length;
  const educationScore = scaled(completeEducationCount, 2, 15);

  const skillsCount = (profile.skills ?? []).filter(nonEmpty).length;
  const skillsScore = scaled(skillsCount, 5, 20);

  const linkedinScore = nonEmpty(profile.linkedin_url) || nonEmpty(profile.raw_linkedin_paste) ? 5 : 0;

  const total =
    contactScore + workRightsScore + experienceScore + educationScore + skillsScore + linkedinScore;

  return Math.max(0, Math.min(100, Math.round(total)));
}
