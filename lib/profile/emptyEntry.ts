import type { EducationEntry, ProjectEntry, RefereeEntry, WorkExperienceEntry, WorkExperienceWin } from "@/types";

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

/** Same "every field genuinely untouched" test as above, for a work experience row - used to skip
 * the remove-role confirm when the card being removed was never filled in (e.g. added via "+ Add
 * role" then immediately dismissed). Any win already built on the role counts as content, even if
 * every other field is blank. */
export function isRoleEntryEmpty(entry: WorkExperienceEntry): boolean {
  return (
    !entry.job_title.trim() &&
    !entry.company.trim() &&
    !entry.location.trim() &&
    !entry.start_date.trim() &&
    !entry.end_date.trim() &&
    !entry.is_current &&
    !entry.description.trim() &&
    entry.wins.length === 0
  );
}

/** Same test for a standalone project row. */
export function isProjectEntryEmpty(entry: ProjectEntry): boolean {
  return (
    !entry.title.trim() &&
    !entry.description.trim() &&
    !entry.context.trim() &&
    !entry.timeframe.trim() &&
    entry.tools.length === 0 &&
    !entry.link.trim() &&
    !entry.outcome.trim() &&
    !entry.outcome_metric.trim()
  );
}

/** Same test for a single win row - covers both a blank "+ Write a line" draft and a win built
 * with WinBuilder that somehow carries no slots, so removing either closes silently. */
export function isWinEmpty(win: WorkExperienceWin): boolean {
  return (
    !win.text.trim() &&
    !win.metric.trim() &&
    !win.verb?.trim() &&
    !win.what?.trim() &&
    !win.outcome?.trim() &&
    (!win.tools || win.tools.length === 0) &&
    (!win.stakeholders || win.stakeholders.length === 0)
  );
}
