/**
 * Cleaning for job title / company / link data that arrives from scraped pages (the Chrome
 * extension) and for showing stored applications. Scrapers fall back to placeholders ("Company",
 * "Manual application | Dayforce Jobs") when a page has no structured job data; those must never
 * be saved as a real employer or role, or shown back to the user as one.
 */

/** Generic words scrapers and ATS pages use where a real company name should be. */
const PLACEHOLDER_COMPANIES = new Set([
  "company",
  "the company",
  "company name",
  "unknown",
  "unknown company",
  "employer",
  "workday employer",
  "pageup employer",
  "livehire employer",
  "jobs",
  "careers",
  "apply",
  "n/a",
  "na",
  "-",
]);

/** ATS step/page names that end up as the "job title" when a scraper reads the page heading or <title>. */
const PLACEHOLDER_TITLE =
  /^(manual application|application|apply|apply now|job application|application form|submit application|candidate home|careers?|jobs?|job details|job search|search jobs|sign in|log ?in|create account|my applications?)$/i;

/** Suffixes ATS sites append to page titles: "Manual application | Dayforce Jobs". */
// Only page-title tails ("| Dayforce Jobs", "- SEEK Careers"), never a real title like
// "HRIS Analyst - Workday", where the platform is the job.
const SITE_SUFFIX =
  /\s*(?:\|\s*(?:dayforce|workday|pageup|livehire|seek|linkedin|greenhouse|lever|smartrecruiters|workable|ashby|bamboohr|indeed|jora)\b.*|[-–—]\s*(?:dayforce|workday|pageup|livehire|seek|linkedin|greenhouse|lever|smartrecruiters|workable|ashby|bamboohr|indeed|jora)\s+(?:jobs|careers)\b.*)$/i;

function squash(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isPlaceholderCompany(name: string | null | undefined): boolean {
  const value = squash(name ?? "").toLowerCase();
  return !value || PLACEHOLDER_COMPANIES.has(value);
}

export function isPlaceholderTitle(title: string | null | undefined, pageTitle?: string | null): boolean {
  const value = squash(title ?? "");
  if (!value) return true;
  // The browser tab title is the page, not the role (unless the user confirmed it).
  if (pageTitle && value.toLowerCase() === squash(pageTitle).toLowerCase() && SITE_SUFFIX.test(value)) return true;
  return PLACEHOLDER_TITLE.test(value.replace(SITE_SUFFIX, "").trim());
}

/** The company name to show or save, or "" when it's missing or a placeholder. */
export function cleanCompanyName(name: string | null | undefined): string {
  return isPlaceholderCompany(name) ? "" : squash(name ?? "");
}

/** The job title to save: "" when it's a placeholder, otherwise trimmed and without an ATS site suffix. */
export function cleanJobTitle(title: string | null | undefined, pageTitle?: string | null): string {
  return isPlaceholderTitle(title, pageTitle) ? "" : stripSiteSuffix(title);
}

/** For a sentence: the company, else "the company". */
export function companyOrFallback(name: string | null | undefined, fallback = "the company"): string {
  return cleanCompanyName(name) || fallback;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** A page title without its ATS site suffix, as a suggestion for the user to confirm. */
export function stripSiteSuffix(title: string | null | undefined): string {
  return squash(title ?? "").replace(SITE_SUFFIX, "").trim();
}

function parse(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * The employer from an ATS link's tenant slug, for sites that host many employers:
 * jobs.dayforcehcm.com/en-AU/avant/... -> "Avant", acme.wd3.myworkdayjobs.com -> "Acme".
 */
export function companyFromAtsUrl(url: string | null | undefined): string {
  const parsed = parse(url);
  if (!parsed) return "";
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);
  let slug = "";
  if (host.endsWith("dayforcehcm.com")) {
    // /en-AU/<tenant>/... or /<tenant>/...
    slug = /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0] ?? "") ? segments[1] ?? "" : segments[0] ?? "";
  } else if (host.endsWith("myworkdayjobs.com")) {
    slug = host.split(".")[0];
  } else if (host.endsWith("myworkdaysite.com")) {
    // wd3.myworkdaysite.com/<locale>/recruiting/<tenant>/...
    const i = segments.indexOf("recruiting");
    slug = i >= 0 ? segments[i + 1] ?? "" : "";
  } else if ((host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") && segments[0] === "embed") {
    slug = parsed.searchParams.get("for") ?? "";
  } else if (
    host === "boards.greenhouse.io" ||
    host === "job-boards.greenhouse.io" ||
    host === "jobs.lever.co" ||
    host === "jobs.ashbyhq.com" ||
    host === "jobs.smartrecruiters.com" ||
    host === "apply.workable.com"
  ) {
    slug = segments[0] ?? "";
  } else if (host.endsWith(".bamboohr.com") || host.endsWith(".applytojob.com") || host.endsWith(".breezy.hr")) {
    slug = host.split(".")[0];
  } else if (host.endsWith("livehire.com")) {
    // livehire.com/careers/<tenant>/...
    const i = segments.indexOf("careers");
    slug = i >= 0 ? segments[i + 1] ?? "" : "";
  }
  if (!slug || /^\d+$/.test(slug) || ["www", "jobs", "careers", "apply", "candidate", "en"].includes(slug.toLowerCase())) return "";
  return titleCaseSlug(decodeURIComponent(slug));
}

/** A trailing apply step: "/apply", "/apply/", "/apply/manualApplication". */
const APPLY_STEP = /\/(?:apply|application|applynow|apply-now)(?:\/[A-Za-z]+)?\/?$/i;

const TRACKING_PARAM = /^(utm_\w+|ref|referrer|gh_src|lever-source|lever-origin|trk|trackingid|fbclid|gclid|mc_\w+)$/i;

/**
 * The job ad's own link rather than an application step inside it: drops "/apply/manualApplication",
 * "/apply", "/application" tails, tracking parameters and the hash.
 */
export function jobAdUrl(url: string | null | undefined): string | null {
  const parsed = parse(url);
  if (!parsed) return url ?? null;
  const path = parsed.pathname.replace(APPLY_STEP, "") || "/";
  // Some ATS identify the job in the query (?jobId=123), so only tracking parameters go.
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAM.test(key)) parsed.searchParams.delete(key);
  }
  const query = parsed.searchParams.toString();
  // "#/jobs/111" is the page on hash-routed career sites; any other hash is just a scroll target.
  const hashRoute = /^#!?\//.test(parsed.hash) ? parsed.hash : "";
  return `${parsed.protocol}//${parsed.host}${path === "/" ? "" : path.replace(/\/$/, "")}${query ? `?${query}` : ""}${hashRoute}`;
}

const SITE_NAMES: Array<[RegExp, string]> = [
  [/seek\.com\.au$/, "SEEK"],
  [/linkedin\.com$/, "LinkedIn"],
  [/dayforcehcm\.com$/, "Dayforce"],
  [/(myworkdayjobs|myworkdaysite|workday)\.com$/, "Workday"],
  [/pageuppeople\.com$/, "PageUp"],
  [/livehire\.com$/, "LiveHire"],
  [/greenhouse\.io$/, "Greenhouse"],
  [/lever\.co$/, "Lever"],
  [/smartrecruiters\.com$/, "SmartRecruiters"],
  [/workable\.com$/, "Workable"],
  [/ashbyhq\.com$/, "Ashby"],
  [/bamboohr\.com$/, "BambooHR"],
  [/indeed\.com(\.au)?$/, "Indeed"],
  [/jora\.com$/, "Jora"],
];

/** A readable site name for a link ("Dayforce"), else its bare host. */
export function siteNameFromUrl(url: string | null | undefined): string {
  const parsed = parse(url);
  if (!parsed) return "";
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  return SITE_NAMES.find(([re]) => re.test(host))?.[1] ?? host;
}

/** Notes older extension builds wrote; an internal marker, never shown as the user's notes. */
const LEGACY_EXTENSION_NOTE = /^Logged via ApplyLab Co-Pilot on (\S+)$/;

/**
 * Whether an application came from the Chrome extension, and from which site. New rows carry
 * source = "extension"; older ones only have the legacy note.
 */
export function extensionOrigin(app: {
  source?: string | null;
  notes?: string | null;
  job_url?: string | null;
}): { site: string } | null {
  const legacy = app.notes ? LEGACY_EXTENSION_NOTE.exec(app.notes.trim()) : null;
  if (app.source !== "extension" && !legacy) return null;
  const fromUrl = siteNameFromUrl(app.job_url);
  const fromNote = legacy && legacy[1] !== "Other" ? legacy[1] : "";
  return { site: fromNote || fromUrl };
}

/** The user's own notes: the legacy extension marker is hidden. */
export function userNotes(notes: string | null | undefined): string {
  const value = notes?.trim() ?? "";
  return LEGACY_EXTENSION_NOTE.test(value) ? "" : value;
}
