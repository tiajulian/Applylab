import type { EducationEntry, RefereeEntry } from "@/types";

/** A default blank row (see EMPTY_EDUCATION/EMPTY_REFEREE in useProfileFieldsState.ts) is "empty"
 * for the purposes of the compact-row treatment - shown as a one-line "+ Add" affordance instead
 * of a full editor - only while every field is genuinely untouched. Any single field filled in
 * counts as real content and keeps (or returns) the row to its full editor, so a half-filled row
 * (e.g. a school name with no dates yet) is never hidden behind a collapsed summary. */
export function isEducationEntryEmpty(entry: EducationEntry): boolean {
  return (
    !entry.degree.trim() &&
    !entry.institution.trim() &&
    !entry.start_date.trim() &&
    !entry.end_date.trim() &&
    !entry.is_current &&
    !entry.notes.trim()
  );
}

export function isRefereeEntryEmpty(entry: RefereeEntry): boolean {
  return (
    !entry.name.trim() &&
    !entry.title.trim() &&
    !entry.organisation.trim() &&
    !entry.phone.trim() &&
    !entry.email.trim()
  );
}
