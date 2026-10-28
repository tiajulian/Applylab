import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { FUTURE_TOLERANCE_MONTHS, nowMonthIndex, parseEntryEnd, parseRoleDate } from "@/lib/profile/parseRoleDate";
import { analyzeResume } from "./contentChecks";
import { relevantExperience, yearsClaims } from "./relevantExperience";
import type { FactCheckFlag, GateCheckResult, GateResult, ResumeContent, UserProfile } from "@/types";

/**
 * Deterministic quality gate run after generation, before a resume is returned or saved (see
 * app/api/generate-resume/route.ts). Composes the existing fact-check flags rather than
 * re-deriving them, adds the checks that were previously missing (date/duration consistency,
 * user-data coverage), and never edits, invents, or auto-regenerates content - a failing check
 * marks the resume needs-review and surfaces why; it does not fix anything itself.
 *
 * Checks are independent and registered in CHECKS below, so a later check (see the backlog
 * comment at the bottom of this file) can be added without touching the ones before it.
 */
export interface GateContext {
  resume: ResumeContent;
  profile: UserProfile | null;
  /** Already computed by the caller via flagUnverifiedFacts (lib/resume/factCheck.ts) - the gate
   * composes this, it does not re-run the check itself. */
  factCheckFlags: FactCheckFlag[];
  /** Already computed by the caller via flagUnconfirmedBridgeClaims. Empty when no bridge was used. */
  bridgeFactCheckFlags: FactCheckFlag[];
  /** The title the summary is written for (summaryTargetTitle). When set, a years claim is checked
   * against the roles related to it, not the whole career. */
  targetTitle?: string;
}

type GateCheck = (ctx: GateContext) => GateCheckResult;

export function runQualityGate(ctx: GateContext): GateResult {
  const checks = CHECKS.map((check) => check(ctx));
  const needsReview = checks.some((check) => check.severity === "hard_fail" && !check.passed);
  return sanitizeDeep({ needsReview, checks });
}

// ---------------------------------------------------------------------------------------------
// Part C: truthfulness (composes flagUnverifiedFacts + flagUnconfirmedBridgeClaims)
// ---------------------------------------------------------------------------------------------

function checkTruthfulness(ctx: GateContext): GateCheckResult {
  const flags = [...ctx.factCheckFlags, ...ctx.bridgeFactCheckFlags];
  return {
    id: "truthfulness",
    label: "Facts trace back to your profile",
    passed: flags.length === 0,
    severity: "hard_fail",
    details: flags.map((flag) => `${flag.location}: ${flag.message}`),
  };
}

// ---------------------------------------------------------------------------------------------
// Part D: date and duration consistency
// ---------------------------------------------------------------------------------------------

/** Impossible values and unexplained overlaps - informational, not a hard fail. This checks the
 * candidate's own profile dates, not anything the model generated, so a genuine irregularity
 * (two concurrent part-time roles, a typo) is worth surfacing but not worth blocking on. */
function checkDateValidity(ctx: GateContext): GateCheckResult {
  const roles = ctx.profile?.work_experience ?? [];
  const details: string[] = [];
  const nowValue = nowMonthIndex();

  const parsed = roles.map((role) => ({
    role,
    start: parseRoleDate(role.start_date, 0),
    end: parseEntryEnd(role, 11),
  }));

  for (const { role, start, end } of parsed) {
    const label = `${role.job_title || "Role"} at ${role.company || "company"}`;
    if (start !== null && start > nowValue + FUTURE_TOLERANCE_MONTHS) {
      details.push(`${label}: start date "${role.start_date}" is in the future.`);
    }
    if (end !== null && end > nowValue + FUTURE_TOLERANCE_MONTHS) {
      details.push(`${label}: end date "${role.end_date}" is in the future.`);
    }
    if (start !== null && end !== null && end < start) {
      details.push(`${label}: end date "${role.end_date}" is before start date "${role.start_date}".`);
    }
  }

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      if (a.start === null || a.end === null || b.start === null || b.end === null) continue;
      const overlapMonths = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlapMonths > 1) {
        details.push(
          `${a.role.job_title || "Role"} at ${a.role.company} overlaps with ${b.role.job_title || "role"} at ${b.role.company} by about ${Math.round(overlapMonths)} months. If these were concurrent, no action needed, otherwise check the dates.`
        );
      }
    }
  }

  return {
    id: "date_validity",
    label: "Employment dates are internally consistent",
    passed: details.length === 0,
    severity: "warning",
    details,
  };
}

/** Catches the "3+ years" summary claim versus a 2021 start case: a duration claim in the
 * AI-generated summary that the candidate's own merged dates don't support. This is the one
 * date check that's about content the model wrote, not the candidate's own data, so it's a hard
 * fail like the other honesty checks - an ungrounded duration claim is a fabrication risk in
 * exactly the same way an ungrounded number is. */
function checkDurationClaim(ctx: GateContext): GateCheckResult {
  const summary = ctx.resume.summary ?? "";
  const matches = yearsClaims(summary);
  if (matches.length === 0) {
    return { id: "duration_claim", label: "Summary experience claim matches your dates", passed: true, severity: "hard_fail", details: [] };
  }

  const roles = ctx.profile?.work_experience ?? [];
  if (ctx.targetTitle) {
    // Only roles in the same field count: years as a barista don't make an analytics engineer.
    const { years } = relevantExperience(roles, ctx.targetTitle);
    const overclaims = matches.filter((claimed) => claimed > years + 1);
    return {
      id: "duration_claim",
      label: "Summary experience claim matches your dates",
      passed: overclaims.length === 0,
      severity: "hard_fail",
      details: overclaims.map(
        (claimed) =>
          `The summary claims "${claimed}+ years", but your roles related to ${ctx.targetTitle} only cover about ${years} ${years === 1 ? "year" : "years"}.`
      ),
    };
  }
  // Conservative (smallest possible) span: latest plausible start, earliest plausible end for
  // each unspecified month, so a flag only fires when the claim is too big even generously read.
  const starts = roles.map((r) => parseRoleDate(r.start_date, 11)).filter((v): v is number => v !== null);
  const ends = roles.map((r) => parseEntryEnd(r, 0)).filter((v): v is number => v !== null);

  if (starts.length === 0 || ends.length === 0) {
    // No parseable dates to check against - can't contradict what we can't compute.
    return { id: "duration_claim", label: "Summary experience claim matches your dates", passed: true, severity: "hard_fail", details: [] };
  }

  const spanMonths = Math.max(...ends) - Math.min(...starts);
  const spanYears = spanMonths / 12;
  const buffer = 1; // rounding/inclusive-year tolerance
  const overclaims = matches.filter((claimed) => claimed > spanYears + buffer);

  return {
    id: "duration_claim",
    label: "Summary experience claim matches your dates",
    passed: overclaims.length === 0,
    severity: "hard_fail",
    details: overclaims.map(
      (claimed) => `The summary claims "${claimed}+ years" but your dates only support about ${Math.floor(spanYears)} years.`
    ),
  };
}

/** Numbers in a summary that the profile never mentions ("managed a $2M budget", "led 12 people"):
 * the summary is the model's own prose, so every figure in it has to come from the candidate. Years
 * claims are checked by checkDurationClaim and calendar years by the fact check, so both are skipped. */
function checkSummaryNumbers(ctx: GateContext): GateCheckResult {
  const summary = (ctx.resume.summary ?? "")
    .replace(/\d+\s*\+?\s*(?:years?|yrs?)\b/gi, "")
    // Names and grades, not figures: "Microsoft 365", "APS 6", "Year 12", "24/7".
    .replace(/\b(?:Microsoft|Office|Windows|Dynamics|Year|APS|EL|Level|Grade|Band|Cert(?:ificate)?|Diploma|ISO|SOC|PCI|Big|ASX|Python|Java|iOS|Android)\s\d+\b/g, "")
    .replace(/\d+\/\d+/g, "");
  const profile = ctx.profile;
  const pool = [
    ...(profile?.work_experience ?? []).flatMap((role) => [
      role.job_title,
      role.company,
      role.location,
      role.description,
      ...(role.wins ?? []).flatMap((win) => [win.text, win.metric, win.outcome ?? "", win.what ?? "", ...(win.tools ?? [])]),
    ]),
    ...(profile?.projects ?? []).flatMap((p) => [p.title, p.description ?? "", p.outcome ?? "", p.outcome_metric ?? ""]),
    ...(profile?.education ?? []).flatMap((edu) => [edu.degree, edu.institution, edu.notes ?? ""]),
    // Employer names and titles as written on the resume ("7-Eleven", "Big 4").
    ...(ctx.resume.experience ?? []).flatMap((entry) => [entry.company, entry.job_title]),
    ...(ctx.resume.tools ?? []),
    ...(profile?.skills ?? []),
    ...(profile?.tools ?? []),
    ctx.targetTitle ?? "",
    profile?.raw_linkedin_paste ?? "",
  ].join(" ");
  const numbersIn = (text: string) =>
    (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "")).filter((n) => !/^(19|20)\d{2}$/.test(n));
  const known = new Set(numbersIn(pool));
  const unbacked = Array.from(new Set(numbersIn(summary).filter((n) => !known.has(n))));
  return {
    id: "summary_numbers",
    label: "Numbers in the summary come from your profile",
    passed: unbacked.length === 0,
    severity: "hard_fail",
    details: unbacked.map((n) => `The summary mentions "${n}", which isn't anywhere in your profile. Check it wasn't invented.`),
  };
}

// ---------------------------------------------------------------------------------------------
// Part E: user-data coverage (guards the Part A wins bug)
// ---------------------------------------------------------------------------------------------

function significantWords(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
}

/** Hard fail only for the bug case: wins exist on the profile but not one of them shows up
 * anywhere in the resume - the WINS section silently never reached the model or never survived
 * the merge. Partial coverage is not flagged: the match is by shared words, and a reworded win
 * often shares none with its source, so per-win checking would fail real resumes. */
function checkUserDataCoverage(ctx: GateContext): GateCheckResult {
  const wins = (ctx.profile?.work_experience ?? []).flatMap((role) => (role.wins ?? []).filter((win) => win.text?.trim()));
  if (wins.length === 0) {
    return { id: "user_data_coverage", label: "Provided wins are represented", passed: true, severity: "hard_fail", details: [] };
  }

  const bulletWords = new Set(ctx.resume.experience.flatMap((entry) => entry.bullets.flatMap(significantWords)));
  const represented = wins.some((win) => {
    const words = significantWords(win.text);
    return words.length > 0 ? words.some((word) => bulletWords.has(word)) : false;
  });

  return {
    id: "user_data_coverage",
    label: "Provided wins are represented",
    passed: represented,
    severity: "hard_fail",
    details: represented
      ? []
      : [`You added ${wins.length} ${wins.length === 1 ? "win" : "wins"} to your profile, but none of them appear to be reflected in this resume.`],
  };
}

// ---------------------------------------------------------------------------------------------
// Part F: cheap deterministic extras (reuse analyzeResume rather than re-scanning bullets)
// ---------------------------------------------------------------------------------------------

function checkAiSmellPhrases(ctx: GateContext): GateCheckResult {
  const findings = analyzeResume(ctx.resume);
  return {
    id: "ai_smell_phrases",
    label: "No generic AI-sounding phrases",
    passed: findings.buzzwordBullets.length === 0,
    severity: "warning",
    details: findings.buzzwordBullets.map((b) => `"${b.phrase}" in: ${b.bullet}`),
  };
}

/** Exact or near-duplicate bullets across the whole resume (not just within one role) - cheap
 * word-overlap check, not semantic similarity. */
function checkDuplicateBullets(ctx: GateContext): GateCheckResult {
  const expBullets = ctx.resume.experience.flatMap((entry) => entry.bullets).filter((b) => b.trim());
  const projBullets = (ctx.resume.projects ?? [])
    .flatMap((entry) => entry.bullets ?? [])
    .filter((b): b is string => Boolean(b && b.trim()));
  const bullets = [...expBullets, ...projBullets];
  const details: string[] = [];
  const seen: Array<{ text: string; words: Set<string> }> = [];

  for (const bullet of bullets) {
    const words = new Set(significantWords(bullet));
    const near = seen.find((s) => {
      const overlap = [...words].filter((w) => s.words.has(w)).length;
      const union = new Set([...words, ...s.words]).size;
      return union > 0 && overlap / union > 0.75;
    });
    if (near) {
      details.push(`"${bullet}" looks near-duplicate to "${near.text}".`);
    } else {
      seen.push({ text: bullet, words });
    }
  }

  return {
    id: "duplicate_bullets",
    label: "No near-duplicate bullets",
    passed: details.length === 0,
    severity: "warning",
    details,
  };
}

function checkLength(ctx: GateContext): GateCheckResult {
  const findings = analyzeResume(ctx.resume);
  const overLength = findings.estimatedPages > 2;
  return {
    id: "length",
    label: "Fits the one-to-two-page budget",
    passed: !overLength,
    severity: "warning",
    details: overLength ? [`Estimated length is about ${findings.estimatedPages} pages.`] : [],
  };
}

/** Catches word-for-word metric or accomplishment duplication between the Professional Summary and Experience bullets. */
function checkSummaryExperienceDuplication(ctx: GateContext): GateCheckResult {
  const summary = ctx.resume.summary ?? "";
  const bullets = ctx.resume.experience.flatMap((e) => e.bullets);
  const details: string[] = [];

  const summaryMetrics = Array.from(summary.matchAll(/(\d+\s*[%$kM]|reduced\s+[\w\s]+by\s+\d+%\b)/gi)).map((m) => m[0].toLowerCase());
  if (summaryMetrics.length > 0) {
    for (const metric of summaryMetrics) {
      const matchBullet = bullets.find((b) => b.toLowerCase().includes(metric));
      if (matchBullet) {
        details.push(`Summary metric "${metric}" is repeated word-for-word in bullet: "${matchBullet}".`);
      }
    }
  }

  return {
    id: "summary_experience_duplication",
    label: "No metric duplication between summary and experience",
    passed: details.length === 0,
    severity: "warning",
    details,
  };
}

const CHECKS: GateCheck[] = [
  checkTruthfulness,
  checkDurationClaim,
  checkSummaryNumbers,
  checkUserDataCoverage,
  checkDateValidity,
  checkAiSmellPhrases,
  checkDuplicateBullets,
  checkSummaryExperienceDuplication,
  checkLength,
];

/**
 * Backlog (documented here, not built yet - each needs an AI call, the rendered PDF, or scope
 * beyond what's cheap and deterministic): seniority-language check, recruiter 10-second test,
 * relevance scoring, JD-alignment (partly scoreATS already), grammar/language quality,
 * formatting and PDF-render checks, ATS text-extraction check on the final PDF, skimmability,
 * bullet-tense consistency for current vs past roles (needs real NLP to avoid false positives,
 * not attempted here), and coverage checks for confirmed projects/role-duties (skipped
 * deliberately - both are legitimately selective by design, so "none included" isn't a bug the
 * way it is for wins).
 */
