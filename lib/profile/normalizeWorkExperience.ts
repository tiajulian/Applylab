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

/** Normalizes a work_experience array read from storage so every entry has the current `wins`
 * shape, regardless of when it was saved. Call this at every read boundary (server routes,
 * profile forms) rather than trusting the stored shape matches WorkExperienceEntry. */
export function normalizeWorkExperience(entries: WorkExperienceEntry[] | null | undefined): WorkExperienceEntry[] {
  if (!entries) return [];
  return entries.map((entry) => ({ ...entry, wins: migrateWins(entry) }));
}
