import type {
  BridgeConfidence,
  BridgeItemState,
  BridgeMode,
  ConfirmedBridge,
  ConfirmedBridgeItem,
  ConfirmedRoleDuty,
  FactCheckFlag,
  FactCheckTarget,
  ResumeContent,
  RoleDutyItem,
  RoleDutySuggestion,
  SkillsBridgeItem,
  UserProfile,
  WorkExperienceEntry,
  WorkExperienceWin,
} from "@/types";
import { cleanStringList } from "@/lib/text/cleanStringList";
import { escapeRegExp } from "@/lib/text/escapeRegExp";

export type { FactCheckFlag, FactCheckTarget };

const NUMBER_REGEX = /\$?\d[\d,]*(?:\.\d+)?%?/g;
const YEAR_REGEX = /\b(?:19|20)\d{2}\b/g;

/** Status/temporal claims the model is banned from inventing (see the summary rules in
 * RESUME_SYSTEM_PROMPT, lib/anthropic/generateResume.ts) unless the exact phrase family appears
 * in the candidate's own education or LinkedIn-paste text. Deliberately narrow and literal, same
 * "heuristic backstop, not proof" spirit as the rest of this file. */
const STATUS_CLAIM_PATTERNS: RegExp[] = [
  /currently (studying|completing|enrolled|undertaking|pursuing)[^.]*/i,
  /(?:actively )?pursuing (?:a|an|his|her|their)[^.]*/i,
  /enrolled in[^.]*/i,
  /transitioning (?:into|to|from)[^.]*/i,
  /working towards? (?:a|an|his|her|their)[^.]*/i,
];

/** Case/whitespace-insensitive identity comparison, shared by every matcher in this file and by
 * the role-duties routes (see app/api/role-duties/route.ts, app/api/generate-resume/route.ts) so
 * "same job title" means the same thing everywhere a confirmed duty gets matched back to a role. */
export function normalize(text: string): string {
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
 * Same identity-matching intent as findSourceExperience above, for the profile-level projects
 * source set: a generated project is matched back to its confirmed profile entry by title (a
 * project has no company/job_title pair to key off), falling back to position so a merely
 * reordered project doesn't false-positive on every field.
 */
export function findSourceProject<T extends { title: string }>(
  entry: { title: string },
  sourceProjects: T[],
  index: number
): T | undefined {
  const exact = sourceProjects.find((s) => normalize(s.title) === normalize(entry.title));
  if (exact) return exact;

  return sourceProjects[index];
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
 *
 * confirmedRoleDuties works the same way for the role-duties feature (see
 * app/api/role-duties/route.ts, lib/anthropic/roleDuties.ts): each entry is a duty the candidate
 * ticked as true for a job title, pooled in for any role sharing that job title (matched by title
 * alone, not company - the suggestion was role-based, not tied to one specific job instance).
 */
export function flagUnverifiedFacts(
  resume: ResumeContent,
  profile: UserProfile | null,
  confirmedBridge?: ConfirmedBridge | null,
  confirmedRoleDuties?: ConfirmedRoleDuty[] | null
): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  const sourceExperience = profile?.work_experience ?? [];
  const rawContext = profile?.raw_linkedin_paste ?? "";
  const bridgeItems = confirmedBridge?.items ?? [];
  const roleDuties = confirmedRoleDuties ?? [];

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
          target: { kind: "experienceHeader", index, field: "role" },
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
        target: { kind: "experienceHeader", index, field: "company" },
      });
    }

    if (entry.job_title.trim() && normalize(entry.job_title) !== normalize(source.job_title)) {
      flags.push({
        severity: "high",
        location: label,
        value: entry.job_title,
        message: `Job title "${entry.job_title}" doesn't match your profile ("${source.job_title}") for this role.`,
        target: { kind: "experienceHeader", index, field: "job_title" },
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
              target: { kind: "experienceHeader", index, field: "dates" },
            });
          }
        }
      }
    }

    const sourceNumbers = new Set(
      tokens(poolText(roleEvidence(source, bridgeItems, roleDuties), rawContext), NUMBER_REGEX)
    );
    entry.bullets.forEach((bullet, bulletIndex) => {
      for (const num of tokens(bullet, NUMBER_REGEX)) {
        if (!sourceNumbers.has(num)) {
          flags.push({
            severity: "high",
            location: `${label}, bullet ${bulletIndex + 1}`,
            value: num,
            message: `The figure "${num}" doesn't appear in what you provided for this role. Check it's accurate before exporting.`,
            target: { kind: "experienceBullet", index, bulletIndex },
          });
        }
      }
    });
  });

  const sourceProjects = profile?.projects ?? [];
  resume.projects.forEach((entry, index) => {
    const label = `Project #${index + 1} (${entry.title || "project"})`;
    const source = findSourceProject(entry, sourceProjects, index);

    if (!source) {
      if (entry.title.trim()) {
        flags.push({
          severity: "high",
          location: label,
          value: entry.title,
          message: "This project doesn't match anything in your profile. Check it wasn't invented.",
          target: { kind: "projectHeader", index, field: "project" },
        });
      }
      return;
    }

    if (entry.title.trim() && normalize(entry.title) !== normalize(source.title)) {
      flags.push({
        severity: "high",
        location: label,
        value: entry.title,
        message: `Project title "${entry.title}" doesn't match your profile ("${source.title}") for this project.`,
        target: { kind: "projectHeader", index, field: "title" },
      });
    }

    const sourceYears = new Set(tokens(source.timeframe, YEAR_REGEX));
    if (sourceYears.size > 0) {
      for (const year of tokens(entry.year, YEAR_REGEX)) {
        if (!sourceYears.has(year)) {
          flags.push({
            severity: "high",
            location: label,
            value: year,
            message: `Date "${entry.year}" doesn't match the timeframe your profile gives for this project.`,
            target: { kind: "projectHeader", index, field: "year" },
          });
        }
      }
    }

    const sourceNumbers = new Set(
      tokens(poolText(source.description, source.outcome, source.outcome_metric, source.tools.join(" ")), NUMBER_REGEX)
    );
    entry.bullets.forEach((bullet, bulletIndex) => {
      for (const num of tokens(bullet, NUMBER_REGEX)) {
        if (!sourceNumbers.has(num)) {
          flags.push({
            severity: "high",
            location: `${label}, bullet ${bulletIndex + 1}`,
            value: num,
            message: `The figure "${num}" doesn't appear in what you provided for this project. Check it's accurate before exporting.`,
            target: { kind: "projectBullet", index, bulletIndex },
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
        target: { kind: "education", index, field: "degree" },
      });
    }
    if (entry.institution.trim() && normalize(entry.institution) !== normalize(source.institution)) {
      flags.push({
        severity: "high",
        location: `Education #${index + 1}`,
        value: entry.institution,
        message: `Institution "${entry.institution}" doesn't match your profile ("${source.institution}").`,
        target: { kind: "education", index, field: "institution" },
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
          target: { kind: "referee", index },
        });
      }
    });
  }

  flags.push(...flagCrossRoleTools(resume, profile, bridgeItems, roleDuties));
  flags.push(...flagUnsupportedSummaryClaims(resume, profile));
  flags.push(...flagUnsupportedSkillsAndTools(resume, profile, bridgeItems, roleDuties));

  return flags;
}

/**
 * Everything the candidate gave for one role: its raw notes, its wins, the duties they ticked for
 * its job title, and its confirmed Skills Bridge items. Picked tools and stakeholders count too:
 * "Office 365" or "Tier 2 support team" named in a bullet is evidence, not invention.
 */
function roleEvidence(
  source: WorkExperienceEntry,
  bridgeItems: ConfirmedBridgeItem[],
  roleDuties: ConfirmedRoleDuty[]
): string {
  const bridgeEvidence = bridgeItems
    .filter(
      (item) =>
        normalize(item.source_company) === normalize(source.company) &&
        normalize(item.source_job_title) === normalize(source.job_title)
    )
    .map((item) => poolText(item.competency, item.user_note, ...(item.tools ?? []), ...(item.stakeholders ?? [])));

  const dutyEvidence = roleDuties
    .filter((duty) => normalize(duty.job_title) === normalize(source.job_title))
    .map((duty) =>
      poolText(duty.duty_text, duty.outcome_text, duty.outcome_metric, ...(duty.tools ?? []), ...(duty.stakeholders ?? []))
    );

  const winsEvidence = (source.wins ?? []).flatMap((win) => [win.text, win.metric, ...(win.tools ?? []), ...(win.stakeholders ?? [])]);

  return poolText(source.description, ...winsEvidence, ...bridgeEvidence, ...dutyEvidence);
}

// Upper-case acronyms that name a place, a standard, or a kind of system any employer might have
// rather than one employer's own tool, so sharing one across roles is not a leak.
const SHARED_ACRONYMS = new Set([
  "NSW", "VIC", "QLD", "TAS", "ACT", "AUS", "CBD", "USA", "KPI", "KPIS", "SLA", "SLAS", "WHS",
  "OHS", "HSE", "ISO", "CEO", "CFO", "COO", "CTO", "B2B", "B2C", "FAQ", "PDF", "AND", "THE", "FOR",
  "POS", "CRM", "ERP", "SQL", "API", "APIS", "RSA", "RSG", "NDIS", "TAFE", "HTML", "CSS", "EFTPOS",
]);

/** Tool-like terms in free text: acronyms (SIRIUS, SAP) and CamelCase names (SharePoint, eStar). */
function toolLikeTerms(text: string): string[] {
  const acronyms = (text.match(/\b[A-Z][A-Z0-9&]{2,}\b/g) ?? []).filter((t) => !SHARED_ACRONYMS.has(t));
  const camel = text.match(/\b(?:[A-Z][a-z]+[A-Z]|[a-z]+[A-Z])[A-Za-z0-9]*\b/g) ?? [];
  return [...acronyms, ...camel];
}

/**
 * Whole-word matcher with one compiled pattern per term and mode, cached for a single check (never
 * module-wide, so one user's vocabulary doesn't accumulate across requests). A bullet is matched
 * case-sensitively: a tool is a proper noun, so "Teams" or "Square" the product isn't confused with
 * "teams" or "square" the word. The candidate's own evidence is matched ignoring case, so lowercase
 * notes ("used excel") still count as theirs. Both lean towards not flagging.
 */
function wordMatcher(): (text: string, term: string, ignoreCase?: boolean) => boolean {
  const patterns = new Map<string, RegExp>();
  return (text, term, ignoreCase = false) => {
    const key = `${ignoreCase ? "i" : "s"}:${term}`;
    let pattern = patterns.get(key);
    if (!pattern) {
      pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, ignoreCase ? "i" : "");
      patterns.set(key, pattern);
    }
    return pattern.test(text);
  };
}

interface CrossRoleLeak {
  index: number;
  bulletIndex: number;
  term: string;
  /** The role the term actually belongs to, for the flag message. */
  ownerLabel: string;
}

/**
 * A tool or system the candidate named for one role turning up in a different role's bullet
 * (e.g. a bank investigation system in a barista bullet). Only terms that trace to some role's
 * own evidence are checked, and a term counts as a role's when the candidate gave it there, so a
 * tool genuinely used in both roles is never flagged.
 */
function findCrossRoleLeaks(
  resume: ResumeContent,
  profile: UserProfile | null,
  bridgeItems: ConfirmedBridgeItem[],
  roleDuties: ConfirmedRoleDuty[]
): CrossRoleLeak[] {
  const sourceExperience = profile?.work_experience ?? [];
  if (sourceExperience.length < 2) return [];
  const mentions = wordMatcher();

  const evidenceByRole = sourceExperience.map((role) => roleEvidence(role, bridgeItems, roleDuties));
  // Every role at the same employer counts as one: a promotion keeps the same systems, and a
  // retitled entry can be matched to a sibling role at that company.
  const evidenceByCompany = new Map<string, string>();
  sourceExperience.forEach((role, i) => {
    const key = normalize(role.company);
    evidenceByCompany.set(key, poolText(evidenceByCompany.get(key), evidenceByRole[i]));
  });
  // Tools picked for a specific role (wins, duties, bridge items) or named in its notes. The
  // profile-wide skills and tools lists aren't tied to any role, so anything in them is the
  // candidate's to use in any bullet and is never treated as a leak.
  const roleTools = [
    ...sourceExperience.flatMap((role) => (role.wins ?? []).flatMap((win) => win.tools ?? [])),
    ...roleDuties.flatMap((duty) => duty.tools ?? []),
    ...bridgeItems.flatMap((item) => item.tools ?? []),
  ];
  const profileWide = new Set([...(profile?.tools ?? []), ...(profile?.skills ?? [])].map((t) => normalize(t)));
  const vocabulary = Array.from(
    new Set([...roleTools.map((t) => t.trim()).filter((t) => t.length >= 2), ...evidenceByRole.flatMap(toolLikeTerms)])
  ).filter((term) => !profileWide.has(normalize(term)));

  const leaks: CrossRoleLeak[] = [];
  resume.experience.forEach((entry, index) => {
    // No positional fallback: an entry that doesn't match a profile role by company is skipped,
    // never compared against some other employer's evidence.
    const source = findSourceExperience(entry, sourceExperience, -1);
    if (!source) return;
    const ownEvidence = evidenceByCompany.get(normalize(source.company)) ?? "";

    entry.bullets.forEach((bullet, bulletIndex) => {
      for (const term of vocabulary) {
        if (!mentions(bullet, term) || mentions(ownEvidence, term, true)) continue;
        const ownerIndex = evidenceByRole.findIndex((evidence) => mentions(evidence, term));
        if (ownerIndex === -1) continue;
        const owner = sourceExperience[ownerIndex];
        leaks.push({ index, bulletIndex, term, ownerLabel: `${owner.job_title} at ${owner.company}` });
      }
    });
  });
  return leaks;
}

function flagCrossRoleTools(
  resume: ResumeContent,
  profile: UserProfile | null,
  bridgeItems: ConfirmedBridgeItem[],
  roleDuties: ConfirmedRoleDuty[]
): FactCheckFlag[] {
  return findCrossRoleLeaks(resume, profile, bridgeItems, roleDuties).map(({ index, bulletIndex, term, ownerLabel }) => {
    const entry = resume.experience[index];
    return {
      severity: "high",
      location: `Work experience #${index + 1} (${entry.job_title || "role"} at ${entry.company || "company"}), bullet ${bulletIndex + 1}`,
      value: term,
      message: `"${term}" is something you gave for ${ownerLabel}, not this role. Check it belongs here.`,
      target: { kind: "experienceBullet", index, bulletIndex },
    };
  });
}

/**
 * Generation-time repair for findCrossRoleLeaks: removes a leaked tool only when it sits in a
 * closing "using X" / "with X" / "in X" phrase at the end of the bullet or clause (followed by
 * punctuation or nothing), which drops cleanly without changing what the bullet says the candidate
 * did. A leak anywhere else ("Worked with SIRIUS analysts", "in SAP and Excel") is left for the
 * fact-check flag to surface, never rewritten here.
 */
export function stripCrossRoleTools(
  resume: ResumeContent,
  profile: UserProfile | null,
  confirmedBridge?: ConfirmedBridge | null,
  confirmedRoleDuties?: ConfirmedRoleDuty[] | null
): ResumeContent {
  const leaks = findCrossRoleLeaks(resume, profile, confirmedBridge?.items ?? [], confirmedRoleDuties ?? []);
  if (leaks.length === 0) return resume;

  const experience = resume.experience.map((entry) => ({ ...entry, bullets: [...entry.bullets] }));
  for (const { index, bulletIndex, term } of leaks) {
    const phrase = new RegExp(
      `,?\\s+(?:using|via|with|through|in|on)\\s+(?:the\\s+)?${escapeRegExp(term)}(?:\\s+(?:system|platform|software|tool|database))?(?=\\s*(?:[.,;]|$))`
    );
    const bullet = experience[index].bullets[bulletIndex];
    // Only the matched phrase is removed; the rest of the bullet is left exactly as written.
    if (!phrase.test(bullet)) continue;
    const stripped = bullet.replace(phrase, "").trim();
    if (stripped.length > 0) experience[index].bullets[bulletIndex] = stripped;
  }
  return { ...resume, experience };
}

/**
 * Backstop for the summary-grounding rules in RESUME_SYSTEM_PROMPT (lib/anthropic/generateResume.ts):
 * flags a status/enrolment/temporal claim in the summary (e.g. "currently studying") when that exact
 * phrase family doesn't appear anywhere in the candidate's own education entries or LinkedIn paste.
 * Literal phrase matching, not meaning - it will miss a paraphrased fabrication and won't catch a
 * false status stated in different words, so this is a prompt for human review, not proof either way.
 */
function flagUnsupportedSummaryClaims(resume: ResumeContent, profile: UserProfile | null): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  const summary = resume.summary ?? "";
  if (!summary.trim()) return flags;

  const sourceText = poolText(
    profile?.raw_linkedin_paste,
    // is_current is a structured flag, not free text, so a genuinely in-progress qualification
    // needs a literal phrase injected here or it could never satisfy any STATUS_CLAIM_PATTERNS
    // below - one fixed phrase per pattern, covering every phrasing the flag alone honestly
    // implies (only STATUS_CLAIM_PATTERNS' exact trigger words matter here, not real English).
    (profile?.education ?? []).some((edu) => edu.is_current)
      ? "currently studying pursuing a enrolled in transitioning into working towards a"
      : "",
    ...(profile?.education ?? []).flatMap((edu) => [edu.degree, edu.institution, edu.notes])
  );

  for (const pattern of STATUS_CLAIM_PATTERNS) {
    const match = summary.match(pattern);
    if (match && !pattern.test(sourceText)) {
      flags.push({
        severity: "high",
        location: "Summary",
        value: match[0],
        message: `The summary says "${match[0]}", a status claim that doesn't appear anywhere in your profile. Check it wasn't invented.`,
        target: { kind: "summary" },
      });
    }
  }

  return flags;
}

/**
 * Backstop for the skills/tools grounding rules in RESUME_SYSTEM_PROMPT: flags a Key Skills or
 * Tools & Platforms entry that doesn't trace back to the candidate's own profile (skills list, work
 * experience, achievements, or projects). Word-overlap matching, same shape and same caveats as
 * flagUnconfirmedBridgeClaims below - it will miss a paraphrased fabrication and can false-flag
 * coincidental phrasing (e.g. a generic category label with no matching word), so it's a prompt for
 * human review, not proof of anything either way.
 */
function skillsEvidenceChecker(
  profile: UserProfile | null,
  bridgeItems: ConfirmedBridgeItem[],
  roleDuties: ConfirmedRoleDuty[]
): (text: string) => boolean {
  const evidenceText = normalize(
    poolText(
      profile?.skills?.join(" "),
      profile?.tools?.join(" "),
      profile?.raw_linkedin_paste,
      // Per-role evidence includes ticked duties and confirmed Skills Bridge items (wording and
      // picked tools), which the prompt lets Key Skills draw on.
      ...(profile?.work_experience ?? []).map((role) => roleEvidence(role, bridgeItems, roleDuties)),
      // A pivot-mode bridge item may be relabelled in the target field's own term.
      ...bridgeItems.flatMap((item) => [item.target_requirement, ...(item.tools ?? [])]),
      ...roleDuties.flatMap((duty) => duty.tools ?? []),
      ...(profile?.projects ?? []).flatMap((project) => [
        project.description,
        project.outcome,
        project.outcome_metric,
        project.tools.join(" "),
      ])
    )
  );
  const evidenceWords = new Set(evidenceText.split(/[^a-z0-9]+/).filter(Boolean));
  // Spacing and punctuation dropped, so "Power BI" matches "PowerBI" and "Office 365" "Office365".
  const evidenceCompact = evidenceText.replace(/[^a-z0-9]/g, "");

  return (text: string): boolean => {
    const normalized = normalize(text);
    if (normalized && evidenceText.includes(normalized)) return true;
    const compact = normalized.replace(/[^a-z0-9]/g, "");
    if (compact.length >= 3 && evidenceCompact.includes(compact)) return true;
    // No long/significant words left to fuzzy-match (e.g. a short acronym like "SQL" or "AWS") -
    // the exact substring check above is the only signal available, and it already failed.
    return significantWords(text).some((word) => evidenceWords.has(word));
  };
}

/** Splits a "Category: tool, tool" line into its label (null when there is none) and tool names. */
function splitToolLine(toolLine: string): { label: string | null; tools: string[] } {
  const [beforeColon, afterColon] = toolLine.split(/:(.+)/);
  return {
    label: afterColon !== undefined ? beforeColon.trim() : null,
    tools: (afterColon ?? toolLine)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

/**
 * Generation-time enforcement of what flagUnsupportedSkillsAndTools checks: a Key Skill or tool
 * that doesn't trace to the candidate's profile (typically lifted from the job ad) is dropped
 * before the resume is saved, so a job-ad requirement the candidate hasn't shown stays a gap
 * instead of being claimed. A tool line left with no tools is dropped too.
 */
export function pruneUnsupportedSkillsAndTools(
  resume: ResumeContent,
  profile: UserProfile | null,
  confirmedBridge?: ConfirmedBridge | null,
  confirmedRoleDuties?: ConfirmedRoleDuty[] | null
): ResumeContent {
  const isSupported = skillsEvidenceChecker(profile, confirmedBridge?.items ?? [], confirmedRoleDuties ?? []);
  const tools = resume.tools.flatMap((toolLine) => {
    const { label, tools: names } = splitToolLine(toolLine);
    const kept = names.filter(isSupported);
    if (kept.length === 0) return [];
    return [label !== null ? `${label}: ${kept.join(", ")}` : kept.join(", ")];
  });
  const skills = resume.skills.filter((skill) => skill.trim() && isSupported(skill));
  // Never empty a section outright: on a thin profile the word-overlap check can miss every real
  // entry, so they stay and flagUnsupportedSkillsAndTools flags each one for review instead.
  return {
    ...resume,
    skills: skills.length > 0 ? skills : resume.skills,
    tools: tools.length > 0 ? tools : resume.tools,
  };
}

function flagUnsupportedSkillsAndTools(
  resume: ResumeContent,
  profile: UserProfile | null,
  bridgeItems: ConfirmedBridgeItem[],
  roleDuties: ConfirmedRoleDuty[]
): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  const isSupported = skillsEvidenceChecker(profile, bridgeItems, roleDuties);

  resume.skills.forEach((skill, index) => {
    if (!skill.trim() || isSupported(skill)) return;
    flags.push({
      severity: "high",
      location: `Key Skills #${index + 1}`,
      value: skill,
      message: `The skill "${skill}" doesn't trace to anything in your profile. Check it wasn't added from the job description.`,
      target: { kind: "skill", index },
    });
  });

  resume.tools.forEach((toolLine, index) => {
    if (!toolLine.trim()) return;
    for (const toolName of splitToolLine(toolLine).tools) {
      if (!isSupported(toolName)) {
        flags.push({
          severity: "high",
          location: `Tools & Platforms #${index + 1}`,
          value: toolName,
          message: `"${toolName}" doesn't trace to anything in your profile. Check it wasn't added from the job description.`,
          target: { kind: "tool", index },
        });
      }
    }
  });

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
        target: { kind: "experienceHeader", index, field: "role" },
      });
      return;
    }

    if (normalize(entry.start_date) !== normalize(source.start_date) || normalize(entry.end_date) !== normalize(source.end_date)) {
      flags.push({
        severity: "high",
        location: label,
        value: `${entry.start_date} - ${entry.end_date}`,
        message: "Dates for this role changed from the original resume. Check they're still accurate.",
        target: { kind: "experienceHeader", index, field: "dates" },
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
            target: { kind: "experienceBullet", index, bulletIndex },
          });
        }
      }
    });
  });

  retailored.projects.forEach((entry, index) => {
    const label = `Project #${index + 1} (${entry.title || "project"})`;
    const source = findSourceProject(entry, original.projects, index);

    if (!source) {
      flags.push({
        severity: "high",
        location: label,
        value: entry.title,
        message: "This project doesn't match the original resume. Check it wasn't invented.",
        target: { kind: "projectHeader", index, field: "project" },
      });
      return;
    }

    const sourceNumbers = new Set(source.bullets.flatMap((b) => tokens(b, NUMBER_REGEX)));
    entry.bullets.forEach((bullet, bulletIndex) => {
      for (const num of tokens(bullet, NUMBER_REGEX)) {
        if (!sourceNumbers.has(num)) {
          flags.push({
            severity: "high",
            location: `${label}, bullet ${bulletIndex + 1}`,
            value: num,
            message: `The figure "${num}" doesn't appear anywhere in the original resume for this project. Check it's accurate before exporting.`,
            target: { kind: "projectBullet", index, bulletIndex },
          });
        }
      }
    });
  });

  return flags;
}

/** Bullet-scoped equivalent of flagRetailorDrift's number check, for a single AI-assisted edit
 * (see the "trim_unsupported" assist action) rather than a whole resume: true when the revised
 * bullet introduces a number/figure not present in the original, meaning the assist call added
 * rather than only removed content. */
export function bulletIntroducesNewNumbers(original: string, revised: string): boolean {
  const originalNumbers = new Set(tokens(original, NUMBER_REGEX));
  return tokens(revised, NUMBER_REGEX).some((num) => !originalNumbers.has(num));
}

/** Swaps every number in `revised` that isn't in `original` for `placeholder`, so an AI suggestion
 * that invented a metric becomes an editable blank instead of an unusable (or dropped) option. */
export function replaceNewNumbers(original: string, revised: string, placeholder: string): string {
  const originalNumbers = new Set(tokens(original, NUMBER_REGEX));
  return revised.replace(NUMBER_REGEX, (match) => (originalNumbers.has(match.replace(/,/g, "")) ? match : placeholder));
}

/**
 * Guardrail for the Win Builder's optional "polish" pass (see the polish action in
 * lib/anthropic/assistBullet.ts and components/profile/RoleContentList.tsx): a Haiku rewrite of a
 * win's assembled text must only tidy grammar and flow, never add a fact the win's own slots
 * don't already carry. Neither flagRetailorDrift (whole-resume, company/title/date scoped) nor
 * bulletIntroducesNewNumbers alone (numbers only) fit this - a win has no company/title/date to
 * diff, and "don't add a tool/stakeholder/outcome/seniority" needs its own check.
 *
 * Word-overlap heuristic, same spirit and same caveats as flagUnsupportedSkillsAndTools above: it
 * will miss a paraphrased addition and can false-flag coincidental phrasing, so the caller treats
 * any returned message as a reason to make the "Use polished wording" choice deliberate (still
 * shown to the user to accept or reject), not as a second independent proof layer.
 */
export function flagWinPolishDrift(original: WorkExperienceWin, polished: string): string[] {
  const flags: string[] = [];

  if (bulletIntroducesNewNumbers(original.text, polished)) {
    flags.push("This adds a number that wasn't in the original wording.");
  }

  const allowedText = poolText(
    original.text,
    original.metric,
    original.outcome,
    original.what,
    original.verb,
    ...(original.tools ?? []),
    ...(original.stakeholders ?? [])
  );
  const allowedWords = new Set(significantWords(allowedText));
  const newWords = significantWords(polished).filter((word) => !allowedWords.has(word));

  if (newWords.length > 0) {
    flags.push(
      `This uses wording not in the original ("${newWords.join(", ")}") - check it doesn't add a tool, stakeholder, outcome, seniority, or scope that wasn't there.`
    );
  }

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
 * The tap-to-add picks a bridge item may offer, decided on its anchored state (run after
 * anchorBridgeItem, which can demote a matched item to a gap): a matched item never offers any -
 * its evidence is already the candidate's own words - while a gap or to_confirm item keeps its own.
 */
export function offeredBridgePicks(item: {
  state: BridgeItemState;
  suggested_tools?: string[];
  suggested_stakeholders?: string[];
}): { suggested_tools: string[]; suggested_stakeholders: string[] } {
  if (item.state === "matched") return { suggested_tools: [], suggested_stakeholders: [] };
  return { suggested_tools: item.suggested_tools ?? [], suggested_stakeholders: item.suggested_stakeholders ?? [] };
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
 *
 * This is also why undoing a confirmation is safe with no extra plumbing: undo (see
 * app/api/skills-bridge/[bridgeId]/items/[itemId]/route.ts) sets user_state back to "pending" on
 * the same row this function reads. generate-resume's fetchBridgeContext selects these rows fresh
 * from Supabase on every call, no cached snapshot, so an undone item simply fails the filter below
 * on the very next generation. There is nothing else to invalidate.
 */
export function confirmedBridgeItems(items: SkillsBridgeItem[]): ConfirmedBridgeItem[] {
  // state !== "gap" is redundant with the PATCH route's own guard against ever confirming a gap
  // item, by design: this function doesn't trust that guard is the only thing standing between a
  // gap and a resume claim, it re-asserts the invariant itself.
  return items
    .filter((item) => item.user_state === "confirmed" && item.state !== "gap")
    .map((item) => {
      // Picks are only ever offered on answered or claimed items; anything on a matched item didn't
      // come from this app's UI, so it's ignored rather than trusted.
      const tools = item.state === "matched" ? [] : cleanStringList(item.tools);
      const stakeholders = item.state === "matched" ? [] : cleanStringList(item.stakeholders);
      return {
        source_company: item.source_company,
        source_job_title: item.source_job_title,
        competency: item.competency,
        target_requirement: item.target_requirement,
        user_note: item.user_note,
        ...(tools.length > 0 ? { tools } : {}),
        ...(stakeholders.length > 0 ? { stakeholders } : {}),
      };
    });
}

export function buildConfirmedBridge(mode: BridgeMode, items: SkillsBridgeItem[]): ConfirmedBridge | undefined {
  const confirmedItems = confirmedBridgeItems(items);
  return confirmedItems.length === 0 ? undefined : { mode, items: confirmedItems };
}

/**
 * Same purpose as buildConfirmedBridge above, for the role-duties feature: the one gate that
 * decides which suggested duties actually reach generation - only items with user_state
 * "confirmed" ever pass through, structurally, not by convention at each call site.
 *
 * Job titles are stored normalized (see app/api/role-duties/route.ts), so this also resolves
 * each duty back to the real-cased job title from the profile's own work_experience, the way
 * anchorBridgeItem resolves a bridge item to the profile's real company/job_title - what reaches
 * the generation prompt and the fact-check evidence pool is always the candidate's own casing,
 * never the normalized DB key.
 */
export function buildConfirmedRoleDuties(
  suggestions: RoleDutySuggestion[],
  items: RoleDutyItem[],
  workExperience: WorkExperienceEntry[]
): ConfirmedRoleDuty[] {
  const jobTitleBySuggestionId = new Map(suggestions.map((s) => [s.id, s.job_title]));

  const realCasingByNormalized = new Map<string, string>();
  const rolesPerTitle = new Map<string, number>();
  for (const entry of workExperience) {
    if (!entry.job_title.trim()) continue;
    const key = normalize(entry.job_title);
    realCasingByNormalized.set(key, entry.job_title);
    rolesPerTitle.set(key, (rolesPerTitle.get(key) ?? 0) + 1);
  }

  const confirmedDuties: ConfirmedRoleDuty[] = [];
  for (const item of items) {
    if (item.user_state !== "confirmed") continue;
    const normalizedTitle = jobTitleBySuggestionId.get(item.suggestion_id);
    if (!normalizedTitle) continue;
    const jobTitle = realCasingByNormalized.get(normalizedTitle) ?? normalizedTitle;
    const dutyText = item.user_edited_text?.trim() || item.duty_text;
    const outcomeText = item.outcome_text?.trim();
    const outcomeMetric = item.outcome_metric?.trim();
    // A duty is pooled into every role sharing its title, but a tool or stakeholder belongs to one
    // job - so only carry them when exactly one role has this title, never across companies.
    const singleRole = rolesPerTitle.get(normalizedTitle) === 1;
    const tools = singleRole ? cleanStringList(item.tools) : [];
    const stakeholders = singleRole ? cleanStringList(item.stakeholders) : [];
    confirmedDuties.push({
      job_title: jobTitle,
      duty_text: dutyText,
      ...(outcomeText ? { outcome_text: outcomeText } : {}),
      ...(outcomeMetric ? { outcome_metric: outcomeMetric } : {}),
      ...(tools.length > 0 ? { tools } : {}),
      ...(stakeholders.length > 0 ? { stakeholders } : {}),
    });
  }
  return confirmedDuties;
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
 *
 * Checks resume.skills and resume.tools alongside experience bullets: an unconfirmed item's
 * target_requirement (e.g. "Power BI") is exactly as likely to surface as a Key Skills entry or a
 * Tools & Platforms line as it is inside a bullet, and the two list fields went unchecked here
 * even though flagUnsupportedSkillsAndTools above already treats them as first-class claim
 * surfaces against the plain profile.
 */
export function flagUnconfirmedBridgeClaims(resume: ResumeContent, bridgeItems: SkillsBridgeItem[]): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  if (bridgeItems.length === 0) return flags;

  const confirmedVocabulary = new Set(
    bridgeItems
      .filter((item) => item.user_state === "confirmed")
      .flatMap((item) =>
        // The candidate's own tool/people picks are confirmed wording too.
        significantWords(poolText(item.competency, item.target_requirement, item.user_note, ...(item.tools ?? []), ...(item.stakeholders ?? [])))
      )
  );

  const unconfirmedItems = bridgeItems.filter((item) => item.user_state !== "confirmed");

  function checkText(text: string, location: string, target: FactCheckTarget) {
    const words = new Set(significantWords(text));

    for (const item of unconfirmedItems) {
      const distinctiveWords = significantWords(item.target_requirement).filter(
        (word) => !confirmedVocabulary.has(word)
      );
      const overlap = distinctiveWords.filter((word) => words.has(word));

      if (overlap.length > 0) {
        flags.push({
          severity: "high",
          location,
          value: overlap.join(", "),
          message: `This uses language ("${overlap.join(", ")}") tied to a skills-bridge item you didn't confirm ("${item.target_requirement}"). Check it wasn't claimed without confirmation.`,
          target,
          // A `gap` item can never be confirmed (see app/api/skills-bridge/[bridgeId]/items/
          // [itemId]/route.ts's hard invariant) - only point the "Confirm in Skills Bridge" fix at
          // items that transition can actually succeed on, or the panel offers a button that
          // always 400s.
          ...(item.state !== "gap" ? { relatedBridgeItemId: item.id } : {}),
        });
      }
    }
  }

  resume.experience.forEach((entry, index) => {
    const label = `Work experience #${index + 1} (${entry.job_title || "role"} at ${entry.company || "company"})`;
    entry.bullets.forEach((bullet, bulletIndex) =>
      checkText(bullet, `${label}, bullet ${bulletIndex + 1}`, { kind: "experienceBullet", index, bulletIndex })
    );
  });

  resume.skills.forEach((skill, index) =>
    checkText(skill, `Key Skills #${index + 1}`, { kind: "skill", index })
  );

  // Checked as individual tool names, not the whole "Category: a, b, c" line - otherwise a
  // category label alone (e.g. "Coaching" as a heading) could match an unconfirmed item's
  // vocabulary even though none of the actually-listed tools claim it.
  resume.tools.forEach((toolLine, index) => {
    if (!toolLine.trim()) return;
    const [, afterColon] = toolLine.split(/:(.+)/);
    const toolNames = (afterColon ?? toolLine)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    toolNames.forEach((toolName) => checkText(toolName, `Tools & Platforms #${index + 1}`, { kind: "tool", index }));
  });

  return flags;
}
