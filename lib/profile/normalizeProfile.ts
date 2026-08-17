import { normalizeWorkExperience } from "@/lib/profile/normalizeWorkExperience";
import { normalizeEducation } from "@/lib/profile/normalizeEducation";
import { sortByRecency } from "@/lib/profile/parseRoleDate";
import type { EducationEntry, UserProfile, WorkExperienceEntry } from "@/types";

export interface NormalizedProfile {
  workExperience: WorkExperienceEntry[];
  education: EducationEntry[];
  normalizedProfile: UserProfile | null;
}

/**
 * Applies every profile-shape migration a server-side read needs (wins/is_current for
 * work_experience, legacy `year` for education) plus the standard most-recent-first ordering for
 * work_experience (see sortByRecency in lib/profile/parseRoleDate.ts) - every route reading a
 * stored profile must call this rather than trusting the stored shape, since a migration is only
 * ever persisted back to the DB the next time the user saves (the profile edit form migrates on
 * load too, but that's a separate client-side pass over the same data - see
 * lib/profile/useProfileFieldsState.ts). A single shared entry point so every server-side reader
 * (generation, fixes, skills bridge) stays consistent rather than each route remembering its own
 * subset of these calls.
 *
 * education is intentionally NOT sorted here, unlike work_experience: factCheck.ts and the
 * `alignEducationField` fix both match a generated resume's education entries back to the profile
 * by array position, and that position is set once at generation time from this same unsorted
 * order - sorting it here would silently misalign existing resumes against their profile source.
 */
export function normalizeProfile(profileData: UserProfile | null): NormalizedProfile {
  const workExperience = sortByRecency(normalizeWorkExperience(profileData?.work_experience));
  const education = normalizeEducation(profileData?.education);
  const normalizedProfile: UserProfile | null = profileData
    ? { ...profileData, work_experience: workExperience, education }
    : null;
  return { workExperience, education, normalizedProfile };
}
