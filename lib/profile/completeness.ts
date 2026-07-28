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

function isCompleteReferee(entry: RefereeEntry): boolean {
  return nonEmpty(entry.name) && (nonEmpty(entry.email) || nonEmpty(entry.phone));
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

function scaled(count: number, cap: number, weight: number): number {
  return (Math.min(count, cap) / cap) * weight;
}

export function computeCompleteness(profile: ScorableProfile): number {
  const contactFilled = [profile.fullName, profile.phone, profile.location].filter(nonEmpty).length;
  const contactScore = (contactFilled / 3) * 15;

  const workRightsScore = nonEmpty(profile.work_rights) ? 10 : 0;

  const completeExperienceCount = (profile.work_experience ?? []).filter(isCompleteExperience).length;
  const experienceScore = scaled(completeExperienceCount, 3, 30);

  const completeEducationCount = (profile.education ?? []).filter(isCompleteEducation).length;
  const educationScore = scaled(completeEducationCount, 2, 15);

  const skillsCount = (profile.skills ?? []).filter(nonEmpty).length;
  const skillsScore = scaled(skillsCount, 5, 15);

  const linkedinScore = nonEmpty(profile.linkedin_url) || nonEmpty(profile.raw_linkedin_paste) ? 5 : 0;

  const completeRefereeCount = (profile.referees ?? []).filter(isCompleteReferee).length;
  const refereesScore = scaled(completeRefereeCount, 2, 10);

  const total =
    contactScore + workRightsScore + experienceScore + educationScore + skillsScore + linkedinScore + refereesScore;

  return Math.max(0, Math.min(100, Math.round(total)));
}
