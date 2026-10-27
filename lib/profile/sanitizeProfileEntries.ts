import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type {
  EducationEntry,
  ProjectEntry,
  RefereeEntry,
  WorkExperienceEntry,
  WorkExperienceWin,
} from "@/types";

/** Shared by the full profile save (app/api/profile) and the single-entry save the resume editor's
 * Add pop-up uses (app/api/profile/entries), so both write exactly the same shape and bounds. */

// Bounds on stored profile data — this all gets re-embedded into the resume-generation
// prompt on every future generation, so unbounded fields/arrays would let a single save
// inflate Anthropic cost indefinitely.
export const MAX_SHORT_LEN = 500;
export const MAX_LONG_LEN = 5000;
export const MAX_LINKEDIN_PASTE_LEN = 50_000;
export const MAX_LIST_ENTRIES = 30;
export const MAX_SKILLS = 50;
export const MAX_WINS_PER_ROLE = 10;
// Win Builder tool/stakeholder picks - same accumulate-and-reuse cap shape as skills.
export const MAX_TOOLS = 50;
export const MAX_STAKEHOLDERS = 50;
// Bounds for a win's structured slots (Win Builder) - short since each is a single tap-picked or
// briefly-typed chip/phrase, not free prose like win.text.
export const MAX_WIN_SLOT_LEN = 200;
export const MAX_WIN_CHIPS = 10;

export function asString(value: unknown, maxLength: number = MAX_SHORT_LEN): string {
  const str = typeof value === "string" ? value : "";
  return str.slice(0, maxLength);
}

export function asStringArray(value: unknown, maxEntries: number = MAX_SKILLS): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, maxEntries)
    .map((v) => v.slice(0, MAX_SHORT_LEN));
}

export function asRecord(entry: unknown): Record<string, unknown> {
  return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
}

export function asWins(value: unknown): WorkExperienceWin[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_WINS_PER_ROLE)
    .map((raw) => {
      const win = asRecord(raw);
      const win2: WorkExperienceWin = {
        text: asString(win.text, MAX_LONG_LEN),
        metric: asString(win.metric),
      };
      // Win Builder structured slots - optional, additive. Only kept when actually present so a
      // manually-entered legacy win stays a plain { text, metric } row.
      const verb = asString(win.verb, MAX_WIN_SLOT_LEN);
      if (verb) win2.verb = verb;
      const what = asString(win.what, MAX_LONG_LEN);
      if (what) win2.what = what;
      const tools = asStringArray(win.tools, MAX_WIN_CHIPS).map((t) => t.slice(0, MAX_WIN_SLOT_LEN));
      if (tools.length > 0) win2.tools = tools;
      const stakeholders = asStringArray(win.stakeholders, MAX_WIN_CHIPS).map((s) =>
        s.slice(0, MAX_WIN_SLOT_LEN)
      );
      if (stakeholders.length > 0) win2.stakeholders = stakeholders;
      const outcome = asString(win.outcome, MAX_LONG_LEN);
      if (outcome) win2.outcome = outcome;
      return win2;
    })
    .filter((win) => win.text.trim().length > 0);
}

export function asExperience(value: unknown): WorkExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    const isCurrent = entry.is_current === true;
    return sanitizeDeep({
      job_title: asString(entry.job_title),
      company: asString(entry.company),
      location: asString(entry.location),
      start_date: asString(entry.start_date),
      end_date: isCurrent ? "" : asString(entry.end_date),
      is_current: isCurrent,
      description: asString(entry.description, MAX_LONG_LEN),
      wins: asWins(entry.wins),
    });
  });
}

export function asProjects(value: unknown): ProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_LIST_ENTRIES)
    .map((raw) => {
      const entry = asRecord(raw);
      return sanitizeDeep({
        title: asString(entry.title),
        description: asString(entry.description, MAX_LONG_LEN),
        context: asString(entry.context),
        timeframe: asString(entry.timeframe),
        tools: asStringArray(entry.tools),
        link: asString(entry.link),
        outcome: asString(entry.outcome, MAX_LONG_LEN),
        outcome_metric: asString(entry.outcome_metric),
      });
    })
    .filter((entry) => entry.title.trim().length > 0);
}

export function asEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    const isCurrent = entry.is_current === true;
    return sanitizeDeep({
      degree: asString(entry.degree),
      institution: asString(entry.institution),
      start_date: asString(entry.start_date),
      end_date: isCurrent ? "" : asString(entry.end_date),
      is_current: isCurrent,
      notes: asString(entry.notes, MAX_LONG_LEN),
    });
  });
}

export function asReferees(value: unknown): RefereeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    return {
      name: asString(entry.name),
      title: asString(entry.title),
      organisation: asString(entry.organisation),
      phone: asString(entry.phone),
      email: asString(entry.email),
    };
  });
}
