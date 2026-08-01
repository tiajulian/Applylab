import type {
  BridgeConfidence,
  BridgeItemState,
  BridgeMode,
  ConfirmedBridge,
  ResumeContent,
  SkillsBridgeItem,
  UserProfile,
} from "@/types";

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
 *
 * Exported for reuse beyond this file: the Skills Bridge route anchors each bridge item to a
 * real profile job with this same identity logic (see app/api/skills-bridge/route.ts), and
 * flagUnconfirmedBridgeClaims below reuses it too, rather than each maintaining its own matcher.
 * Pass index -1 to disable the positional fallback (returns undefined instead) for callers where
 * there's no meaningful 1:1 ordering to fall back on, e.g. matching a bridge item isn't matching
 * "the Nth experience entry."
 */
export function findSourceExperience<T extends { company: string; job_title: string }>(
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
 *
 * When a confirmedBridge is passed (see lib/anthropic/generateResume.ts), its evidence text
 * (competency + the user's own affirming user_note) is pooled into the same source-of-truth text
 * used for the number/date checks below, per role. Without this, an affirmed `to_confirm` item
 * (real evidence the user just supplied) would get flagged as fabrication the moment its number
 * or detail doesn't appear verbatim in the original raw profile description - which would be
 * wrong, since the user's own confirmation IS valid evidence, not something to distrust.
 */
export function flagUnverifiedFacts(
  resume: ResumeContent,
  profile: UserProfile | null,
  confirmedBridge?: ConfirmedBridge | null
): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  const sourceExperience = profile?.work_experience ?? [];
  const rawContext = profile?.raw_linkedin_paste ?? "";
  const bridgeItems = confirmedBridge?.items ?? [];

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

    const bridgeEvidence = bridgeItems
      .filter(
        (item) =>
          normalize(item.source_company) === normalize(source.company) &&
          normalize(item.source_job_title) === normalize(source.job_title)
      )
      .map((item) => poolText(item.competency, item.user_note))
      .join(" ");

    const sourceNumbers = new Set(tokens(poolText(source.description, rawContext, bridgeEvidence), NUMBER_REGEX));
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

export interface AnchorableBridgeItem {
  source_company: string;
  source_job_title: string;
  source_snippet: string;
  competency: string;
  target_requirement: string;
  state: BridgeItemState;
  confidence: BridgeConfidence;
}

/**
 * Deterministic backstop behind the Skills Bridge analysis prompt (see
 * lib/anthropic/skillsBridge.ts and app/api/skills-bridge/route.ts): a `matched`/`to_confirm`
 * item's source_company and source_job_title must resolve to a real job in the candidate's
 * profile via the exact same identity logic used elsewhere in this file. Index -1 disables the
 * positional fallback - a bridge item isn't "the Nth experience entry," so if it doesn't match by
 * company (and ideally title), it isn't a match at all. Anything that fails this is downgraded to
 * `gap` with its source cleared, never left as a claim with a source that doesn't actually exist.
 */
export function anchorBridgeItem<T extends AnchorableBridgeItem>(item: T, profile: UserProfile): T {
  if (item.state === "gap") {
    return { ...item, source_company: "", source_job_title: "" };
  }

  const source = findSourceExperience(
    { company: item.source_company, job_title: item.source_job_title },
    profile.work_experience ?? [],
    -1
  );

  if (!source) {
    return {
      ...item,
      state: "gap",
      source_company: "",
      source_job_title: "",
      source_snippet: "",
      confidence: "high",
    };
  }

  // findSourceExperience's company-only fallback resolves `source` even when the model's
  // source_job_title doesn't match anything at that company - it was designed to tolerate a
  // resume-generation model reordering roles, not to validate an exact title. Left uncorrected,
  // that meant a bridge item could anchor to a real company (so it passed the "does this company
  // exist" check) while keeping a completely invented job title at that company. Always
  // overwriting with the profile's own company/job_title closes that: what reaches the UI,
  // buildConfirmedBridge, and the generation prompt is always the real title, never the model's.
  return { ...item, source_company: source.company, source_job_title: source.job_title };
}

/**
 * The one gate that actually matters for "never fabricate": only items the user has confirmed
 * (matched items, which start pre-confirmed, plus to_confirm items they affirmed) ever become
 * part of what's passed into generation. Rejected, still-pending, and gap items - regardless of
 * how confident the analysis was - are excluded here, structurally, not by convention at each
 * call site. See app/api/generate-resume/route.ts, which calls this on every bridge item for the
 * bridge being used, not just the ones that happen to still be pending.
 */
export function buildConfirmedBridge(mode: BridgeMode, items: SkillsBridgeItem[]): ConfirmedBridge | undefined {
  // state !== "gap" is redundant with the PATCH route's own guard against ever confirming a gap
  // item, by design: this function doesn't trust that guard is the only thing standing between a
  // gap and a resume claim, it re-asserts the invariant itself.
  const confirmedItems = items.filter((item) => item.user_state === "confirmed" && item.state !== "gap");
  if (confirmedItems.length === 0) return undefined;

  return {
    mode,
    items: confirmedItems.map((item) => ({
      source_company: item.source_company,
      source_job_title: item.source_job_title,
      competency: item.competency,
      target_requirement: item.target_requirement,
      user_note: item.user_note,
    })),
  };
}

const BRIDGE_STOPWORDS = new Set([
  "about", "above", "after", "again", "their", "there", "these", "those", "which", "while",
  "would", "should", "could", "other", "using", "under", "within", "across", "through",
]);

function significantWords(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 5 && !BRIDGE_STOPWORDS.has(word));
}

/**
 * Honesty backstop for the Skills Bridge (see app/api/skills-bridge/route.ts and part E of
 * lib/anthropic/generateResume.ts). The real guarantee that a resume only claims confirmed
 * competencies is structural: app/api/generate-resume/route.ts only ever passes CONFIRMED bridge
 * items into generation, so an unconfirmed item's language should never reach the model in the
 * first place. This function is a second, heuristic line of defence on top of that - it does NOT
 * re-derive whether a claim is true, it only checks whether the resume's bullet text overlaps
 * with the distinctive vocabulary of a target_requirement the candidate did NOT confirm (a
 * `gap`, a `to_confirm` they said "not really" to, or one still `pending`). That is word-overlap
 * matching, not semantic understanding - it will miss paraphrased fabrications and can false-flag
 * coincidental phrasing, so treat it as a prompt for human review, not proof of anything.
 *
 * Takes ALL of a bridge's items (any user_state), not just the confirmed ones, since it needs to
 * know what was NOT confirmed in order to check for it.
 */
export function flagUnconfirmedBridgeClaims(resume: ResumeContent, bridgeItems: SkillsBridgeItem[]): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  if (bridgeItems.length === 0) return flags;

  const confirmedVocabulary = new Set(
    bridgeItems
      .filter((item) => item.user_state === "confirmed")
      .flatMap((item) => significantWords(poolText(item.competency, item.target_requirement, item.user_note)))
  );

  const unconfirmedItems = bridgeItems.filter((item) => item.user_state !== "confirmed");

  resume.experience.forEach((entry, index) => {
    const label = `Work experience #${index + 1} (${entry.job_title || "role"} at ${entry.company || "company"})`;

    entry.bullets.forEach((bullet, bulletIndex) => {
      const bulletWords = new Set(significantWords(bullet));

      for (const item of unconfirmedItems) {
        const distinctiveWords = significantWords(item.target_requirement).filter(
          (word) => !confirmedVocabulary.has(word)
        );
        const overlap = distinctiveWords.filter((word) => bulletWords.has(word));

        if (overlap.length > 0) {
          flags.push({
            severity: "high",
            location: `${label}, bullet ${bulletIndex + 1}`,
            value: overlap.join(", "),
            message: `This bullet uses language ("${overlap.join(", ")}") tied to a skills-bridge item you didn't confirm ("${item.target_requirement}"). Check it wasn't claimed without confirmation.`,
          });
        }
      }
    });
  });

  return flags;
}
