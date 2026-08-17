import { PRESENT_WORDS } from "@/lib/profile/parseRoleDate";
import type { EducationEntry } from "@/types";

/** Migrates a pre-date-range row (single free-text `year`, e.g. "2018 - 2022" or "2022") into the
 * current start_date/end_date/is_current shape, same treatment as
 * lib/profile/normalizeWorkExperience.ts#migrateIsCurrent for work_experience. Call this at every
 * read boundary (server routes, profile forms) rather than trusting the stored shape matches
 * EducationEntry. */
function migrateDates(entry: unknown): { start_date: string; end_date: string; is_current: boolean } {
  const raw = entry as { start_date?: string; end_date?: string; is_current?: boolean; year?: string };
  if (typeof raw.start_date === "string" || typeof raw.end_date === "string" || typeof raw.is_current === "boolean") {
    return { start_date: raw.start_date ?? "", end_date: raw.end_date ?? "", is_current: raw.is_current ?? false };
  }

  const legacyYear = (raw.year ?? "").trim();
  if (!legacyYear) return { start_date: "", end_date: "", is_current: false };
  if (PRESENT_WORDS.has(legacyYear.toLowerCase())) {
    return { start_date: "", end_date: "", is_current: true };
  }

  const [rawStart, rawEnd] = legacyYear.split(/\s*[-–—]\s*/);
  if (rawEnd !== undefined) {
    const isCurrent = PRESENT_WORDS.has(rawEnd.trim().toLowerCase());
    return { start_date: rawStart.trim(), end_date: isCurrent ? "" : rawEnd.trim(), is_current: isCurrent };
  }
  // A single value with no range separator reads most naturally as a completion year.
  return { start_date: "", end_date: legacyYear, is_current: false };
}

export function normalizeEducation(entries: EducationEntry[] | null | undefined): EducationEntry[] {
  if (!entries) return [];
  return entries.map((entry) => {
    const raw = entry as { degree?: string; institution?: string; notes?: string };
    return {
      degree: raw.degree ?? "",
      institution: raw.institution ?? "",
      notes: raw.notes ?? "",
      ...migrateDates(entry),
    };
  });
}
