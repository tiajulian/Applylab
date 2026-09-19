import { nowMonthIndex, parseRoleDate } from "@/lib/profile/parseRoleDate";
import { analyzeResume } from "./contentChecks";
import type { FactCheckTarget, ResumeContent, ResumeExperienceEntry, ResumeReviewFinding } from "@/types";

/**
 * Deterministic "did the candidate finish filling this in?" checks: placeholder/cut-off
 * employers, missing dates, duplicate or inconsistently spelled roles, chronology problems,
 * empty entries, casing/typos in job titles, tense, overclaiming, and thin contact details. These
 * are the mistakes a human reviewer spots in seconds but a bullet-level AI pass never looks at,
 * because they live in the headers and structure, not the bullet text. Pure and synchronous, so
 * it runs identically in both review paths (AI and deterministic-only fallback).
 *
 * Judgement calls (is this bullet relevant to the target role? does the career narrative match
 * the target title?) are deliberately NOT here - see REVIEW_SYSTEM_PROMPT in scoreReview.ts.
 */

// Common title words used to catch a one-letter typo ("enginer") without needing a dictionary.
const TITLE_VOCAB = [
  "engineer", "analyst", "manager", "developer", "coordinator", "consultant", "specialist",
  "officer", "associate", "administrator", "director", "assistant", "technician", "supervisor",
  "executive", "architect", "scientist", "designer", "accountant", "advisor", "representative",
  "investigator", "compliance", "financial", "transaction", "monitoring", "analytics", "operations",
  "marketing", "software", "customer", "business", "project", "product", "senior", "graduate",
  "support", "lead", "intern", "barista", "recruiter", "controller", "strategist", "adviser",
];

const PLACEHOLDER_COMPANY =
  /^(abc(\s*[-–—]\s*\S{1,10})?|xyz|test(ing)?|sample|company( name)?|employer|your company|lorem|ipsum|tbd|tba|n\/?a|asdf|qwerty|foo|bar)$/i;

// "Acme - s": a separator followed by a 1-2 character tail is a name cut off mid-word.
const CUT_OFF_COMPANY = /\s[-–—|,]\s?\w{1,2}$/;

// Case-sensitive on purpose: "sa"/"wa"/"act" are ordinary words in lowercase.
const AU_STATE_CODE = /\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/;
const REGION_TAIL = /^(SA|WA|NT|UK|US|NZ|HK|EU)$/;
const CURRENT_END = /^(present|current|now|ongoing|to date)$/i;
// Words that stay lowercase inside a Title Case title ("Head of Risk", "Analyst in Training").
const TITLE_SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "for", "in", "of", "on", "or", "the", "to", "with", "&"]);
const DASHES_ONLY = /^[\s\-–—]*$/;

const IRREGULAR_PAST = new Set([
  "led", "built", "ran", "drove", "wrote", "made", "took", "grew", "won", "taught", "sold",
  "spent", "began", "oversaw", "undertook", "held", "chose", "shaped", "brought", "kept",
]);
const NOT_PAST = new Set(["need", "seed", "speed", "embed", "feed", "proceed", "succeed", "exceed", "indeed", "bleed", "breed"]);

interface Ctx {
  resume: ResumeContent;
  now: number;
  findings: ResumeReviewFinding[];
}

function add(
  ctx: Ctx,
  id: string,
  severity: "warning" | "info",
  title: string,
  detail: string,
  fix_text: string,
  resume_location: string,
  target?: FactCheckTarget
): void {
  ctx.findings.push({
    id: `integrity-${id}`,
    category_key: "application_readiness",
    severity,
    title,
    detail,
    fix_text,
    resume_location,
    target,
    status: "open",
  });
}

const roleLabel = (e: ResumeExperienceEntry) =>
  [e.job_title, e.company].map((s) => s?.trim()).filter(Boolean).join(" @ ") || "Untitled role";

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** First word starts lowercase and has no capital anywhere in it (so "iOS", "eBay" are fine). */
const startsLowercase = (text: string) => {
  const first = text.trim().split(/\s+/)[0] ?? "";
  return /^[a-z]/.test(first) && !/[A-Z]/.test(first);
};

const isCurrent = (e: ResumeExperienceEntry) => CURRENT_END.test((e.end_date ?? "").trim());
const isBlankDate = (s: string) => DASHES_ONLY.test(s ?? "");

function checkRoleHeaders(ctx: Ctx): void {
  const known = new Set(
    [...ctx.resume.skills, ...ctx.resume.tools, ...ctx.resume.experience.map((e) => e.company)]
      .join(" ")
      .toLowerCase()
      .match(/[a-z]+/g) ?? []
  );

  ctx.resume.experience.forEach((e, i) => {
    const label = roleLabel(e);
    const title = (e.job_title ?? "").trim();
    const company = (e.company ?? "").trim();
    const hasContent = Boolean(title || company || e.bullets.some((b) => b.trim()));
    if (!hasContent) return;

    // Employer
    if (!company) {
      add(ctx, `company-missing-${i}`, "warning", "Employer name is missing",
        `"${title || label}" has no company, so recruiters can't verify the role.`,
        "Add the employer's name, or remove the entry if it was added by mistake.", label,
        { kind: "experienceHeader", index: i, field: "company" });
    } else if (PLACEHOLDER_COMPANY.test(company)) {
      add(ctx, `company-placeholder-${i}`, "warning", `"${company}" looks like a placeholder employer`,
        "Placeholder names make the role look unfinished and can't be verified.",
        "Replace it with the real employer name.", label,
        { kind: "experienceHeader", index: i, field: "company" });
    } else if (CUT_OFF_COMPANY.test(company) && !REGION_TAIL.test(company.split(/[-–—|,]/).pop()!.trim())) {
      add(ctx, `company-cutoff-${i}`, "warning", `Employer name "${company}" looks cut off`,
        "The name ends with a stray fragment after a separator.",
        "Finish or correct the employer name.", label,
        { kind: "experienceHeader", index: i, field: "company" });
    }

    if (company && /^[a-z]/.test(company) && !/[A-Z]/.test(company)) {
      add(ctx, `company-case-${i}`, "info", `Employer "${company}" isn't capitalised`,
        "Company names are proper nouns; all-lowercase looks unedited.",
        "Capitalise it the way the employer writes its own name.", label,
        { kind: "experienceHeader", index: i, field: "company" });
    }

    const lowerBullet = e.bullets.findIndex((b) => startsLowercase(b));
    if (lowerBullet !== -1) {
      add(ctx, `bullet-case-${i}`, "info", "Bullet starts with a lowercase letter",
        `${label} has a bullet beginning "${e.bullets[lowerBullet].trim().slice(0, 30)}".`,
        "Start every bullet with a capital letter.", label,
        { kind: "experienceBullet", index: i, bulletIndex: lowerBullet });
    }

    // Title
    if (!title) {
      add(ctx, `title-missing-${i}`, "warning", "Job title is missing",
        `The role at "${company || "this employer"}" has no title.`,
        "Add the title you held.", label, { kind: "experienceHeader", index: i, field: "job_title" });
    } else {
      // A word starting lowercase (bar small words mid-title and camelCase like "iOS") means the
      // title isn't Title Case, which reads as an unedited draft next to the properly cased ones.
      const badCase = title.split(/\s+/).some(
        (w, k) => /^[a-z]/.test(w) && !/[A-Z]/.test(w) && (k === 0 || !TITLE_SMALL_WORDS.has(w))
      );
      if (badCase) {
        add(ctx, `title-case-${i}`, "info", `Job title "${title}" isn't capitalised`,
          "Other titles use Title Case; a lowercase one looks like an unedited draft.",
          "Capitalise each main word, e.g. \"Barista\" or \"Senior Analytics Engineer\".", label,
          { kind: "experienceHeader", index: i, field: "job_title" });
      }
      const typo = (title.toLowerCase().match(/[a-z]+/g) ?? []).find((word) => {
        if (word.length < 5 || known.has(word) || TITLE_VOCAB.includes(word)) return false;
        return TITLE_VOCAB.some((v) => !word.startsWith(v) && !v.startsWith(word) && levenshtein(word, v) === 1);
      });
      if (typo) {
        const fix = TITLE_VOCAB.find((v) => levenshtein(typo, v) === 1) as string;
        add(ctx, `title-typo-${i}`, "warning", `Possible typo in job title: "${typo}"`,
          `"${typo}" is one letter off "${fix}".`, `Correct it to "${fix}" if that's what you meant.`, label,
          { kind: "experienceHeader", index: i, field: "job_title" });
      }
    }

    // Dates
    const start = (e.start_date ?? "").trim();
    const end = (e.end_date ?? "").trim();
    if (isBlankDate(start) || isBlankDate(end)) {
      add(ctx, `dates-missing-${i}`, "warning", "Employment dates are missing or incomplete",
        `${label} ${isBlankDate(start) && isBlankDate(end) ? "has no dates" : isBlankDate(start) ? "has no start date" : "has no end date"}, which leaves a trailing dash and a gap recruiters will question.`,
        "Add the start and end month/year (or \"Present\" if it's your current role).", label,
        { kind: "experienceHeader", index: i, field: "dates" });
    } else {
      const s = parseRoleDate(start, 0);
      const en = CURRENT_END.test(end) ? null : parseRoleDate(end, 11);
      if (s !== null && s > ctx.now + 1) {
        add(ctx, `dates-future-${i}`, "warning", "Start date is in the future", `${label} starts "${start}".`,
          "Check the start date.", label, { kind: "experienceHeader", index: i, field: "dates" });
      } else if (s !== null && en !== null && en < s) {
        add(ctx, `dates-order-${i}`, "warning", "End date is before the start date", `${label}: "${start}" to "${end}".`,
          "Swap or correct the dates.", label, { kind: "experienceHeader", index: i, field: "dates" });
      }
    }

    // Empty entry
    if (!e.bullets.some((b) => b.trim())) {
      add(ctx, `no-bullets-${i}`, "info", "Role has no bullets", `${label} lists no responsibilities or achievements.`,
        "Add 2-4 bullets, or remove the entry if it's a leftover duplicate.", label,
        { kind: "experienceHeader", index: i, field: "role" });
    }
  });
}

function checkAcrossRoles(ctx: Ctx): void {
  const roles = ctx.resume.experience;

  // Duplicates / inconsistent spelling of the same employer.
  const flaggedDup = new Set<number>();
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const [a, b] = [roles[i], roles[j]];
      const [ca, cb] = [norm(a.company), norm(b.company)];
      if (!ca || !cb) continue;
      const similar = ca === cb || (Math.min(ca.length, cb.length) >= 4 && levenshtein(ca, cb) <= 2);
      if (!similar) continue;

      if (norm(a.job_title) && norm(a.job_title) === norm(b.job_title)) {
        const dropIdx = a.bullets.filter((x) => x.trim()).length < b.bullets.filter((x) => x.trim()).length ? i : j;
        if (!flaggedDup.has(dropIdx)) {
          flaggedDup.add(dropIdx);
          add(ctx, `duplicate-role-${dropIdx}`, "warning", "Duplicate role entry",
            `"${roleLabel(roles[dropIdx])}" appears more than once.`,
            "Delete the duplicate (usually the one with fewer bullets).", roleLabel(roles[dropIdx]),
            { kind: "experienceHeader", index: dropIdx, field: "role" });
        }
      }
      if (ca !== cb) {
        add(ctx, `company-spelling-${j}`, "warning", `Employer spelled two ways: "${a.company.trim()}" vs "${b.company.trim()}"`,
          "Inconsistent spelling suggests a typo and confuses ATS matching.", "Use one spelling of the employer's official name.",
          roleLabel(b), { kind: "experienceHeader", index: j, field: "company" });
      }
    }
  }

  // Chronology: newest first.
  const starts = roles.map((r) => parseRoleDate(r.start_date, 0));
  for (let i = 0; i < roles.length - 1; i++) {
    const [s1, s2] = [starts[i], starts[i + 1]];
    if (s1 !== null && s2 !== null && s1 < s2) {
      add(ctx, "chronology", "warning", "Roles aren't in reverse-chronological order",
        `"${roleLabel(roles[i + 1])}" started after "${roleLabel(roles[i])}" but is listed below it.`,
        "Order roles newest first, the format recruiters and ATS parsers expect.", roleLabel(roles[i + 1]),
        { kind: "experienceHeader", index: i + 1, field: "dates" });
      break;
    }
  }

  // Too many simultaneous "current" roles.
  const current = roles.map((r, i) => ({ r, i })).filter(({ r }) => isCurrent(r));
  if (current.length >= 3) {
    const oldest = current.reduce((best, c) => ((starts[c.i] ?? Infinity) < (starts[best.i] ?? Infinity) ? c : best));
    add(ctx, "many-current", "warning", `${current.length} roles are marked as current`,
      "Several concurrent full-time-looking jobs is a credibility red flag unless they're clearly casual, part-time or freelance.",
      "End the roles that have finished, or label concurrent ones as part-time/freelance.", roleLabel(oldest.r),
      { kind: "experienceHeader", index: oldest.i, field: "dates" });
  }

  // Tense: current roles read in the present tense.
  current.forEach(({ r, i }) => {
    const bullets = r.bullets.map((b, bulletIndex) => ({ b: b.trim(), bulletIndex })).filter(({ b }) => b);
    const past = bullets.filter(({ b }) => {
      const w = b.match(/^[A-Za-z]+/)?.[0].toLowerCase() ?? "";
      return IRREGULAR_PAST.has(w) || (w.length >= 5 && w.endsWith("ed") && !NOT_PAST.has(w));
    });
    if (past.length >= 2) {
      add(ctx, `tense-${i}`, "info", "Current role written in the past tense",
        `${roleLabel(r)} is marked current, but ${past.length} bullets start with past-tense verbs.`,
        "Use present tense for ongoing duties (\"Extract\" not \"Extracted\") and keep past tense for finished roles.",
        roleLabel(r), { kind: "experienceBullet", index: i, bulletIndex: past[0].bulletIndex });
    }
  });
}

function checkProjects(ctx: Ctx): void {
  ctx.resume.projects.forEach((p, i) => {
    const title = (p.title ?? "").trim();
    const hasBullets = p.bullets.some((b) => b.trim());
    if (!title && !hasBullets) {
      add(ctx, `project-empty-${i}`, "warning", "Empty project entry", "This project has no title or content.",
        "Fill it in or delete it.", "Projects", { kind: "projectHeader", index: i, field: "project" });
    } else if (!title) {
      add(ctx, `project-untitled-${i}`, "warning", "Project has no title", "Bullets appear under a project with no name.",
        "Add a project title.", "Projects", { kind: "projectHeader", index: i, field: "title" });
    }
  });
}

function checkSummaryAndContact(ctx: Ctx): void {
  const { resume } = ctx;
  if (/\bexpert(s)?\b/i.test(resume.summary ?? "")) {
    add(ctx, "overclaim", "info", "\"Expert\" may overclaim",
      "Absolute claims invite scrutiny at interview and can't be backed by a resume alone.",
      "Prefer \"skilled in\", \"proficient in\" or \"experienced in\", and let the results prove it.", "Summary",
      { kind: "summary" });
  }

  if (startsLowercase(resume.summary ?? "")) {
    add(ctx, "summary-case", "info", "Summary starts with a lowercase letter", "The opening line looks unedited.",
      "Start the summary with a capital letter.", "Summary", { kind: "summary" });
  }

  const contact = resume.contact;
  if (/^[a-z]/.test(contact.name?.trim() ?? "")) {
    add(ctx, "name-case", "info", "Your name isn't capitalised", `"${contact.name.trim()}" is the first thing a recruiter reads.`,
      "Capitalise your name.", "Contact details");
  }
  if (!contact.linkedin?.trim()) {
    add(ctx, "no-linkedin", "info", "No LinkedIn or professional profile link",
      "Most recruiters look up candidates on LinkedIn before calling.", "Add your LinkedIn URL to the contact details.",
      "Contact details");
  }
  const location = contact.location?.trim();
  if (location && !location.includes(",") && !AU_STATE_CODE.test(location) && !/australia/i.test(location)) {
    add(ctx, "location-partial", "info", `Location "${location}" has no city or state`,
      "A bare suburb is ambiguous, and location filters on job boards expect a city and state.",
      "Use the form \"Suburb, City STATE\", e.g. \"Kogarah, Sydney NSW\".", "Contact details");
  }
}

/** Returns the findings only; readinessChecks.ts applies the score deduction. */
export function checkResumeIntegrity(resume: ResumeContent, now: number = nowMonthIndex()): ResumeReviewFinding[] {
  const ctx: Ctx = { resume, now, findings: [] };
  checkRoleHeaders(ctx);
  checkAcrossRoles(ctx);
  checkProjects(ctx);
  checkSummaryAndContact(ctx);

  const analysis = analyzeResume(resume);
  if (analysis.totalBullets >= 3 && analysis.metricPct === 0) {
    add(ctx, "no-metrics", "info", "No quantified achievements anywhere",
      "Not one bullet contains a number, percentage or dollar figure.",
      "Add real figures (volume, time saved, error rate, team size) where you can verify them.", "Work experience");
  }
  return ctx.findings;
}
