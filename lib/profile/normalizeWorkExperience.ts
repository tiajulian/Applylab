import { PRESENT_WORDS } from "@/lib/profile/parseRoleDate";
import type { WorkExperienceEntry, WorkExperienceWin } from "@/types";

/**
 * Migrates a pre-"wins" work_experience entry (single `achievement`/`achievement_metric`
 * strings) into the current `wins` array shape. Shared by every reader of `work_experience` -
 * the profile edit form (via useProfileFieldsState) and every server-side read for generation/
 * fact-check - so a role saved before the wins rework isn't silently missing its wins just
 * because the profile happens not to have been re-saved since. Reads defensively (loosely
 * typed) since legacy rows predate the current WorkExperienceEntry shape and won't type-check
 * against it.
 */
function migrateWins(entry: unknown): WorkExperienceWin[] {
  const raw = entry as { wins?: WorkExperienceWin[]; achievement?: string; achievement_metric?: string };
  if (Array.isArray(raw.wins)) return raw.wins;

  const text = raw.achievement?.trim();
  return text ? [{ text: raw.achievement ?? "", metric: raw.achievement_metric ?? "" }] : [];
}

/** Migrates a pre-is_current row: if is_current was never saved, infer it from a legacy
 * "Present"/"Current"/"Now" end_date so validate.ts's is_current+end_date check doesn't
 * immediately flag every existing "Present" role as an error. Clears end_date once migrated so
 * the two fields stay in the single valid shape going forward. */
function migrateIsCurrent(entry: unknown): { is_current: boolean; end_date: string } {
  const raw = entry as { is_current?: boolean; end_date?: string };
  if (typeof raw.is_current === "boolean") {
    return { is_current: raw.is_current, end_date: raw.end_date ?? "" };
  }
  const endDate = raw.end_date ?? "";
  const isPresent = PRESENT_WORDS.has(endDate.trim().toLowerCase());
  return { is_current: isPresent, end_date: isPresent ? "" : endDate };
}

/** Normalizes a work_experience array read from storage so every entry has the current `wins`
 * and `is_current` shape, regardless of when it was saved. Call this at every read boundary
 * (server routes, profile forms) rather than trusting the stored shape matches
 * WorkExperienceEntry. */
export function normalizeWorkExperience(entries: WorkExperienceEntry[] | null | undefined): WorkExperienceEntry[] {
  if (!entries) return [];
  return entries.map((entry) => ({ ...entry, wins: migrateWins(entry), ...migrateIsCurrent(entry) }));
}
