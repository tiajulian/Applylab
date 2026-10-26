/** Common ways to state Australian work rights, suggested in work rights fields. */
export const WORK_RIGHTS_CATALOG: readonly string[] = [
  "Australian Citizen",
  "Australian Permanent Resident",
  "New Zealand Citizen (Special Category Visa)",
  "Full Working Rights",
  "Temporary Graduate Visa (subclass 485) - Full Working Rights",
  "Skills in Demand Visa (subclass 482)",
  "Temporary Skill Shortage Visa (subclass 482)",
  "Working Holiday Visa (subclass 417)",
  "Work and Holiday Visa (subclass 462)",
  "Student Visa (subclass 500) - Limited Working Rights",
  "Partner Visa - Full Working Rights",
  "Bridging Visa - Full Working Rights",
  "Skilled Independent Visa (subclass 189)",
  "Skilled Nominated Visa (subclass 190)",
  "Skilled Work Regional Visa (subclass 491)",
  "Employer Nominated Visa (subclass 186)",
  "Requires Sponsorship",
];

// Plain statements of work rights, most specific first. Used as a fallback when the AI parser
// leaves work_rights empty on a resume that clearly states it (e.g. "Australian Citizen" in a
// header line), so the scorer doesn't flag missing work rights that are on the page.
const WORK_RIGHTS_PATTERNS: readonly RegExp[] = [
  /\bAustralian\s+citizen(?:ship)?\b/i,
  /\b(?:Australian\s+)?permanent\s+residen(?:t|cy|ce)\b/i,
  /\bNew\s+Zealand\s+citizen\b|\bNZ\s+citizen\b/i,
  /\b(?:full|unrestricted|valid)\s+(?:australian\s+)?work(?:ing)?\s+rights\b/i,
  /\bvisa\s*\(?\s*subclass\s*\d{3}\s*\)?/i,
  /\bsubclass\s*\d{3}\b/i,
];

// Where a candidate states their own work rights: the header (first lines of the resume), or a
// line that labels it. A visa or citizenship mention deep in work history ("processed partner visa
// applications") is about the job, not the candidate, so it isn't read.
const HEADER_LINES = 8;
// A line that starts with a label ("Work rights: ...", "Visa status - ..."), not one that merely
// mentions eligibility or residency in passing ("Assessed client eligibility for visa ...").
const WORK_RIGHTS_LABEL =
  /^\s*(?:australian\s+)?(?:work(?:ing)?\s+rights|right\s+to\s+work|visa(?:\s+status)?|residency(?:\s+status)?|citizenship(?:\s+status)?|work\s+eligibility)\s*[:\-–]/i;

/** The candidate's stated work rights from resume text, trimmed, or "" if there isn't one. */
export function detectWorkRights(text: string): string {
  const lines = text.split(/\r?\n/);
  const candidates = [...lines.slice(0, HEADER_LINES), ...lines.slice(HEADER_LINES).filter((line) => WORK_RIGHTS_LABEL.test(line))];
  const scope = candidates.join("\n");
  for (const pattern of WORK_RIGHTS_PATTERNS) {
    const match = scope.match(pattern);
    if (match) return match[0].replace(/\s+/g, " ").trim();
  }
  return "";
}
