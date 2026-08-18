import { getMissingMvpFields, MVP_FIELD_LABELS, type ScorableProfile } from "@/lib/profile/completeness";
import { FUTURE_TOLERANCE_MONTHS, nowMonthIndex, parseEntryEnd, parseRoleDate } from "@/lib/profile/parseRoleDate";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { EducationEntry, ProjectEntry, RefereeEntry, WorkExperienceEntry } from "@/types";

/**
 * Profile-level input validation: catches problems where the user types them (dates, formats,
 * missing fields) rather than downstream on every generated resume. Deterministic and cheap - no
 * AI calls, reuses lib/profile/completeness.ts rather than re-deriving MVP rules.
 *
 * Division of labour: this module owns date validity/overlaps/formats/completeness/empty-section
 * nudges. Truthfulness, coverage, duration-claim, and AI-smell checks live only in the
 * post-generation gate (lib/resume/qualityGate.ts). Date parsing itself is shared (see
 * lib/profile/parseRoleDate.ts) so the two layers can't drift - this is the layer where a bad
 * date actually gets fixed; the resume gate's date check is a backstop for whatever slips
 * through (e.g. profiles saved before this validator existed).
 *
 * `severity: "error"` = a clear, kind correction for something invalid (end before start, a
 * malformed email/link). `severity: "hint"` = a soft, dismissible nudge about something merely
 * incomplete or worth a second look (overlaps, empty-but-started sections, missing-but-optional
 * fields). Neither ever asks the user to sound more impressive or add a number - only presence
 * and validity are in scope here.
 */

export type ValidationSeverity = "error" | "hint";

export interface ProfileValidationIssue {
  /** Field path issues can be looked up by in the form, e.g. "work_experience.0.end_date",
   * "linkedin_url", "referees.1.email". Entry-level issues (no specific sub-field) use the bare
   * list path, e.g. "work_experience.0". */
  field: string;
  id: string;
  severity: ValidationSeverity;
  message: string;
}

export type ValidateProfileInput = ScorableProfile & { projects?: ProjectEntry[] };

function nonEmpty(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/** Accepts URLs with or without a protocol (e.g. "linkedin.com/in/jamie") since that's how most
 * people paste a profile link. Just needs a dotted hostname, not a live check. */
function isValidUrl(value: string): boolean {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Loose plausibility check, not a strict format - phone conventions vary too widely
 * internationally to hard-validate, so this only catches things that clearly aren't a phone
 * number (too few/many digits). */
function isPlausiblePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

interface DateRangeCheckOptions {
  /** Issue field path prefix, e.g. "work_experience" or "education". */
  basePrefix: string;
  /** Issue id prefix, e.g. "date" or "edu-date" - kept distinct per entry kind so ids never
   * collide across the two checks. */
  idPrefix: string;
  currentConflictMessage: string;
  startFormatExample: string;
  endFormatExample: string;
}

/** Shared date-validity shape for any entry with a start_date/end_date/is_current range - used
 * by both work_experience and education so the two can never drift on which checks they run (see
 * lib/resume/qualityGate.ts#parseRoleEnd for the same is_current-trusts-over-text rule applied
 * post-generation). */
function checkDateRangeEntries<T extends { start_date: string; end_date: string; is_current: boolean }>(
  entries: T[],
  opts: DateRangeCheckOptions
): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];
  const nowValue = nowMonthIndex();

  entries.forEach((entry, i) => {
    const base = `${opts.basePrefix}.${i}`;
    const start = parseRoleDate(entry.start_date, 0);
    const end = parseEntryEnd(entry, 11);

    if (entry.is_current && nonEmpty(entry.end_date)) {
      issues.push({
        field: `${base}.end_date`,
        id: `${opts.idPrefix}-current-conflict-${i}`,
        severity: "error",
        message: opts.currentConflictMessage,
      });
    }

    if (nonEmpty(entry.start_date) && start === null) {
      issues.push({
        field: `${base}.start_date`,
        id: `${opts.idPrefix}-unparseable-start-${i}`,
        severity: "error",
        message: `Doesn't look like a valid date - try a format like ${opts.startFormatExample}.`,
      });
    }
    if (!entry.is_current && nonEmpty(entry.end_date) && end === null) {
      issues.push({
        field: `${base}.end_date`,
        id: `${opts.idPrefix}-unparseable-end-${i}`,
        severity: "error",
        message: `Doesn't look like a valid date - try a format like ${opts.endFormatExample}, or leave blank.`,
      });
    }

    if (start !== null && start > nowValue + FUTURE_TOLERANCE_MONTHS) {
      issues.push({
        field: `${base}.start_date`,
        id: `${opts.idPrefix}-future-start-${i}`,
        severity: "error",
        message: "This start date is in the future.",
      });
    }
    if (!entry.is_current && end !== null && end > nowValue + FUTURE_TOLERANCE_MONTHS) {
      issues.push({
        field: `${base}.end_date`,
        id: `${opts.idPrefix}-future-end-${i}`,
        severity: "error",
        message: "This end date is in the future.",
      });
    }

    if (!entry.is_current && start !== null && end !== null && end < start) {
      issues.push({
        field: `${base}.end_date`,
        id: `${opts.idPrefix}-end-before-start-${i}`,
        severity: "error",
        message: "End date is before the start date.",
      });
    }
  });

  return issues;
}

function checkExperienceDates(experience: WorkExperienceEntry[]): ProfileValidationIssue[] {
  return checkDateRangeEntries(experience, {
    basePrefix: "work_experience",
    idPrefix: "date",
    currentConflictMessage: "This role is marked as current but also has an end date. Clear the end date or untick current role.",
    startFormatExample: "March 2022",
    endFormatExample: "March 2022",
  });
}

function checkEducationDates(education: EducationEntry[]): ProfileValidationIssue[] {
  return checkDateRangeEntries(education, {
    basePrefix: "education",
    idPrefix: "edu-date",
    currentConflictMessage: "This is marked as currently studying but also has an end date. Clear the end date or untick current.",
    startFormatExample: "March 2018",
    endFormatExample: "November 2022",
  });
}

/** Concurrent roles are legitimate (part-time, contracting), so this only ever asks rather than
 * asserts a mistake. */
function checkExperienceOverlaps(experience: WorkExperienceEntry[]): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];
  const parsed = experience.map((entry) => ({
    entry,
    start: parseRoleDate(entry.start_date, 0),
    end: parseEntryEnd(entry, 11),
  }));

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      if (a.start === null || a.end === null || b.start === null || b.end === null) continue;
      const overlapMonths = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlapMonths > 1) {
        issues.push({
          field: `work_experience.${j}`,
          id: `overlap-${i}-${j}`,
          severity: "hint",
          message: `This overlaps with ${a.entry.job_title || "your other role"} at ${a.entry.company || "another company"}. If these were concurrent, no action needed.`,
        });
      }
    }
  }

  return issues;
}

/** Only checks the title-but-no-dates/description case. A blank in-progress win isn't checked
 * here: WinsField already deletes a win's row the moment its editor closes without text, and the
 * save route strips any that slip through, so a per-win check would only ever fire while the
 * user is mid-keystroke on a brand new win - the opposite of gentle. */
function checkExperienceEmptyButStarted(experience: WorkExperienceEntry[]): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];

  experience.forEach((entry, i) => {
    if (!nonEmpty(entry.job_title)) return;

    if (!nonEmpty(entry.start_date) && !nonEmpty(entry.description)) {
      issues.push({
        field: `work_experience.${i}`,
        id: `empty-started-experience-${i}`,
        severity: "hint",
        message: "Add a start date and a short description when you're ready.",
      });
    }
  });

  return issues;
}

function checkEducationEmptyButStarted(education: EducationEntry[]): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];
  education.forEach((entry, i) => {
    const hasDegree = nonEmpty(entry.degree);
    const hasInstitution = nonEmpty(entry.institution);
    if (hasDegree !== hasInstitution) {
      issues.push({
        field: `education.${i}`,
        id: `empty-started-education-${i}`,
        severity: "hint",
        message: hasDegree ? "Add the institution when you're ready." : "Add the qualification name when you're ready.",
      });
    }
  });
  return issues;
}

function checkRefereeEmptyButStarted(referees: RefereeEntry[]): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];
  referees.forEach((entry, i) => {
    if (nonEmpty(entry.name) && !nonEmpty(entry.email) && !nonEmpty(entry.phone)) {
      issues.push({
        field: `referees.${i}`,
        id: `empty-started-referee-${i}`,
        severity: "hint",
        message: "Add a phone number or email so this referee can be reached.",
      });
    }
  });
  return issues;
}

/** A project only saves once it has a title (see ProjectEntry in types/index.ts and the filters
 * in useProfileFieldsState.toPayload / app/api/profile/route.ts#asProjects) - everything else is
 * optional. Without this check, a project with a description but no title is silently dropped on
 * save with no warning, which reads as lost work. */
function checkProjectsEmptyButStarted(projects: ProjectEntry[]): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];
  projects.forEach((entry, i) => {
    const hasOtherContent =
      nonEmpty(entry.description) ||
      nonEmpty(entry.context) ||
      nonEmpty(entry.timeframe) ||
      nonEmpty(entry.link) ||
      nonEmpty(entry.outcome) ||
      (entry.tools ?? []).some(nonEmpty);
    if (!nonEmpty(entry.title) && hasOtherContent) {
      issues.push({
        field: `projects.${i}`,
        id: `empty-title-project-${i}`,
        severity: "error",
        message: "Add a title so this project is saved - it won't be kept without one.",
      });
    }
  });
  return issues;
}

function checkFormats(profile: ValidateProfileInput): ProfileValidationIssue[] {
  const issues: ProfileValidationIssue[] = [];

  if (nonEmpty(profile.linkedin_url) && !isValidUrl(profile.linkedin_url as string)) {
    issues.push({
      field: "linkedin_url",
      id: "format-linkedin",
      severity: "error",
      message: "This doesn't look like a valid link.",
    });
  }

  if (nonEmpty(profile.phone) && !isPlausiblePhone(profile.phone as string)) {
    issues.push({
      field: "phone",
      id: "format-phone",
      severity: "hint",
      message: "Double-check this looks like a phone number.",
    });
  }

  (profile.referees ?? []).forEach((entry, i) => {
    if (nonEmpty(entry.email) && !isValidEmail(entry.email)) {
      issues.push({
        field: `referees.${i}.email`,
        id: `format-referee-email-${i}`,
        severity: "error",
        message: "This doesn't look like a valid email address.",
      });
    }
    if (nonEmpty(entry.phone) && !isPlausiblePhone(entry.phone)) {
      issues.push({
        field: `referees.${i}.phone`,
        id: `format-referee-phone-${i}`,
        severity: "hint",
        message: "Double-check this looks like a phone number.",
      });
    }
  });

  return issues;
}

function checkCompleteness(profile: ValidateProfileInput): ProfileValidationIssue[] {
  const missing = getMissingMvpFields(profile);
  const fieldMap: Record<(typeof missing)[number], string> = {
    fullName: "fullName",
    experience: "work_experience",
    skills: "skills",
    location: "location",
    workRights: "work_rights",
  };

  return missing.map((key) => ({
    field: fieldMap[key],
    id: `mvp-${key}`,
    severity: "hint",
    message: `${MVP_FIELD_LABELS[key]} is needed before you can generate a resume.`,
  }));
}

export function validateProfile(profile: ValidateProfileInput): ProfileValidationIssue[] {
  const experience = profile.work_experience ?? [];
  const education = profile.education ?? [];
  const referees = profile.referees ?? [];
  const projects = profile.projects ?? [];

  const issues = [
    ...checkExperienceDates(experience),
    ...checkEducationDates(education),
    ...checkExperienceOverlaps(experience),
    ...checkFormats(profile),
    ...checkCompleteness(profile),
    ...checkExperienceEmptyButStarted(experience),
    ...checkEducationEmptyButStarted(education),
    ...checkRefereeEmptyButStarted(referees),
    ...checkProjectsEmptyButStarted(projects),
  ];

  return sanitizeDeep(issues);
}

/** Groups issues by field for O(1) inline lookup while rendering the form. */
export function groupIssuesByField(issues: ProfileValidationIssue[]): Map<string, ProfileValidationIssue[]> {
  const map = new Map<string, ProfileValidationIssue[]>();
  for (const issue of issues) {
    const existing = map.get(issue.field);
    if (existing) {
      existing.push(issue);
    } else {
      map.set(issue.field, [issue]);
    }
  }
  return map;
}
