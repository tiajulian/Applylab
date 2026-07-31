import type { ResumeContent, UserProfile } from "@/types";

export interface FactCheckFlag {
  severity: "high";
  location: string;
  message: string;
  /** The exact flagged substring — used to detect when the user has since edited it away. */
  value: string;
}

const NUMBER_REGEX = /\$?\d[\d,]*(?:\.\d+)?%?/g;
const YEAR_REGEX = /\b(?:19|20)\d{2}\b/g;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(text: string, regex: RegExp): string[] {
  return (text.match(regex) ?? []).map((t) => t.replace(/,/g, ""));
}

function poolText(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Matches a generated experience entry back to its profile source by company+title first,
 * falling back to company alone, then position. Matching on identity rather than position
 * tolerates the model reordering roles (which it isn't instructed not to do) without producing
 * a false positive for every field on a merely-reordered entry.
 */
function findSourceExperience<T extends { company: string; job_title: string }>(
  entry: { company: string; job_title: string },
  sourceExperience: T[],
  index: number
): T | undefined {
  const exact = sourceExperience.find(
    (s) => normalize(s.company) === normalize(entry.company) && normalize(s.job_title) === normalize(entry.job_title)
  );
  if (exact) return exact;

  const byCompany = sourceExperience.find((s) => normalize(s.company) === normalize(entry.company));
  if (byCompany) return byCompany;

  return sourceExperience[index];
}

/**
 * Deterministic, heuristic guardrail against generated resumes containing hard facts (company,
 * title, date, metric) that aren't traceable back to the candidate's own profile data. This is
 * intentionally not exhaustive NLP — it exists to surface likely fabrications for human review
 * before export, not to silently block generation.
 */
export function flagUnverifiedFacts(resume: ResumeContent, profile: UserProfile | null): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  const sourceExperience = profile?.work_experience ?? [];
  const rawContext = profile?.raw_linkedin_paste ?? "";

  resume.experience.forEach((entry, index) => {
    const label = `Work experience #${index + 1} (${entry.job_title || "role"} at ${entry.company || "company"})`;
    const source = findSourceExperience(entry, sourceExperience, index);

    if (!source) {
      if (entry.company.trim() || entry.job_title.trim()) {
        flags.push({
          severity: "high",
          location: label,
          value: `${entry.job_title} at ${entry.company}`,
          message: "This role doesn't match anything in your profile. Check it wasn't invented.",
        });
      }
      return;
    }

    if (entry.company.trim() && normalize(entry.company) !== normalize(source.company)) {
      flags.push({
        severity: "high",
        location: label,
        value: entry.company,
        message: `Company "${entry.company}" doesn't match your profile ("${source.company}") for this role.`,
      });
    }

    if (entry.job_title.trim() && normalize(entry.job_title) !== normalize(source.job_title)) {
      flags.push({
        severity: "high",
        location: label,
        value: entry.job_title,
        message: `Job title "${entry.job_title}" doesn't match your profile ("${source.job_title}") for this role.`,
      });
    }

    const sourceYears = new Set([...tokens(source.start_date, YEAR_REGEX), ...tokens(source.end_date, YEAR_REGEX)]);
    if (sourceYears.size > 0) {
      for (const dateField of [entry.start_date, entry.end_date]) {
        for (const year of tokens(dateField, YEAR_REGEX)) {
          if (!sourceYears.has(year)) {
            flags.push({
              severity: "high",
              location: label,
              value: year,
              message: `Date "${dateField}" doesn't match any date your profile gives for this role.`,
            });
          }
        }
      }
    }

    const sourceNumbers = new Set(tokens(poolText(source.description, rawContext), NUMBER_REGEX));
    entry.bullets.forEach((bullet, bulletIndex) => {
      for (const num of tokens(bullet, NUMBER_REGEX)) {
        if (!sourceNumbers.has(num)) {
          flags.push({
            severity: "high",
            location: `${label}, bullet ${bulletIndex + 1}`,
            value: num,
            message: `The figure "${num}" doesn't appear in what you provided for this role. Check it's accurate before exporting.`,
          });
        }
      }
    });
  });

  resume.education.forEach((entry, index) => {
    const source = profile?.education?.[index];
    if (!source) return;

    if (entry.degree.trim() && normalize(entry.degree) !== normalize(source.degree)) {
      flags.push({
        severity: "high",
        location: `Education #${index + 1}`,
        value: entry.degree,
        message: `Degree "${entry.degree}" doesn't match your profile ("${source.degree}").`,
      });
    }
    if (entry.institution.trim() && normalize(entry.institution) !== normalize(source.institution)) {
      flags.push({
        severity: "high",
        location: `Education #${index + 1}`,
        value: entry.institution,
        message: `Institution "${entry.institution}" doesn't match your profile ("${source.institution}").`,
      });
    }
  });

  const sourceReferees = profile?.referees ?? [];
  if (sourceReferees.length > 0) {
    resume.referees.forEach((entry, index) => {
      if (!entry.name.trim()) return;
      const match = sourceReferees.some((r) => normalize(r.name) === normalize(entry.name));
      if (!match) {
        flags.push({
          severity: "high",
          location: `Referee #${index + 1}`,
          value: entry.name,
          message: `Referee "${entry.name}" doesn't appear in your profile. Check it wasn't invented.`,
        });
      }
    });
  }

  return flags;
}

/**
 * Same intent as flagUnverifiedFacts, but for the duplicate-and-retailor flow, where the source
 * of truth is the ORIGINAL resume rather than the raw profile — retailoring is only supposed to
 * re-emphasise summary/skills/bullet phrasing, never change facts. Bullet numbers are checked
 * against the whole original role's bullets (not positionally), since retailoring is allowed to
 * reorder or merge bullets within a role.
 */
export function flagRetailorDrift(retailored: ResumeContent, original: ResumeContent): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];

  retailored.experience.forEach((entry, index) => {
    const label = `Work experience #${index + 1} (${entry.job_title || "role"} at ${entry.company || "company"})`;
    const source = findSourceExperience(entry, original.experience, index);

    if (!source) {
      flags.push({
        severity: "high",
        location: label,
        value: `${entry.job_title} at ${entry.company}`,
        message: "This role doesn't match the original resume. Check it wasn't invented.",
      });
      return;
    }

    if (normalize(entry.start_date) !== normalize(source.start_date) || normalize(entry.end_date) !== normalize(source.end_date)) {
      flags.push({
        severity: "high",
        location: label,
        value: `${entry.start_date} - ${entry.end_date}`,
        message: "Dates for this role changed from the original resume. Check they're still accurate.",
      });
    }

    const sourceNumbers = new Set(source.bullets.flatMap((b) => tokens(b, NUMBER_REGEX)));
    entry.bullets.forEach((bullet, bulletIndex) => {
      for (const num of tokens(bullet, NUMBER_REGEX)) {
        if (!sourceNumbers.has(num)) {
          flags.push({
            severity: "high",
            location: `${label}, bullet ${bulletIndex + 1}`,
            value: num,
            message: `The figure "${num}" doesn't appear anywhere in the original resume for this role. Check it's accurate before exporting.`,
          });
        }
      }
    });
  });

  return flags;
}
