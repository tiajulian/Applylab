import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { analyzeResume } from "./contentChecks";
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

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const PRESENT_WORDS = new Set(["present", "current", "now"]);

/** Parses a free-text role date ("March 2022", "2022", "Present") into a sortable month index
 * (year * 12 + month). When only a year is given, `fallbackMonth` decides which end of that year
 * to assume - callers pass the value that makes their check conservative (least likely to
 * false-positive), not necessarily the most likely reading. Returns null when nothing date-like
 * is found, since free text here can't always be parsed and an unparseable date should never be
 * treated as a contradiction. */
function parseRoleDate(raw: string, fallbackMonth: number): number | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  if (PRESENT_WORDS.has(text.toLowerCase())) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }

  const yearMatch = text.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[0], 10);

  const monthWord = text.toLowerCase().match(/[a-z]+/)?.[0];
  const month = monthWord && monthWord in MONTH_INDEX ? MONTH_INDEX[monthWord] : fallbackMonth;
  return year * 12 + month;
}

/** Impossible values and unexplained overlaps - informational, not a hard fail. This checks the
 * candidate's own profile dates, not anything the model generated, so a genuine irregularity
 * (two concurrent part-time roles, a typo) is worth surfacing but not worth blocking on. */
function checkDateValidity(ctx: GateContext): GateCheckResult {
  const roles = ctx.profile?.work_experience ?? [];
  const details: string[] = [];
  const nowValue = new Date().getFullYear() * 12 + new Date().getMonth();

  const parsed = roles.map((role) => ({
    role,
    start: parseRoleDate(role.start_date, 0),
    end: parseRoleDate(role.end_date, 11),
  }));

  for (const { role, start, end } of parsed) {
    const label = `${role.job_title || "Role"} at ${role.company || "company"}`;
    if (start !== null && start > nowValue + 1) {
      details.push(`${label}: start date "${role.start_date}" is in the future.`);
    }
    if (end !== null && end > nowValue + 1) {
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

const DURATION_CLAIM_REGEX = /(\d+)\s*\+?\s*years?\b/gi;

/** Catches the "3+ years" summary claim versus a 2021 start case: a duration claim in the
 * AI-generated summary that the candidate's own merged dates don't support. This is the one
 * date check that's about content the model wrote, not the candidate's own data, so it's a hard
 * fail like the other honesty checks - an ungrounded duration claim is a fabrication risk in
 * exactly the same way an ungrounded number is. */
function checkDurationClaim(ctx: GateContext): GateCheckResult {
  const summary = ctx.resume.summary ?? "";
  const matches = Array.from(summary.matchAll(DURATION_CLAIM_REGEX)).map((m) => parseInt(m[1], 10));
  if (matches.length === 0) {
    return { id: "duration_claim", label: "Summary experience claim matches your dates", passed: true, severity: "hard_fail", details: [] };
  }

  const roles = ctx.profile?.work_experience ?? [];
  // Conservative (smallest possible) span: latest plausible start, earliest plausible end for
  // each unspecified month, so a flag only fires when the claim is too big even generously read.
  const starts = roles.map((r) => parseRoleDate(r.start_date, 11)).filter((v): v is number => v !== null);
  const ends = roles.map((r) => parseRoleDate(r.end_date, 0)).filter((v): v is number => v !== null);

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
 * the merge. Some wins trimmed while others appear is the normal, expected one-page-tailoring
 * outcome and is not flagged - this check only guards against zero coverage, never partial. */
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
  const bullets = ctx.resume.experience.flatMap((entry) => entry.bullets).filter((b) => b.trim());
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

const CHECKS: GateCheck[] = [
  checkTruthfulness,
  checkDurationClaim,
  checkUserDataCoverage,
  checkDateValidity,
  checkAiSmellPhrases,
  checkDuplicateBullets,
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
