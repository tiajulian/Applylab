import { findSourceExperience, normalize } from "@/lib/resume/factCheck";
import type { ConfirmedBridgeItem, ResumeContent, UserProfile } from "@/types";
import type { ReviewBlock } from "./blocks";
import { clampReason, type RawReviewItem, type ReviewProvenance } from "./types";

export type ProfileSource = Pick<UserProfile, "work_experience" | "projects" | "education" | "skills" | "tools" | "raw_linkedin_paste"> & {
  /** What the person confirmed in the skills bridge. It is their own affirmation, so a claim it backs is
   * not "new" - even when they chose not to save it to the profile. Gap items never appear here. */
  confirmed_bridge?: ConfirmedBridgeItem[];
};

/** What a confirmed item can vouch for. The requirement is the job posting's wording, so it can back a tool
 * or skill name the person affirmed, but never a number, and text copied from it is not "their own".
 * Numbers rest on the person's own words (their note and the competency drawn from their history). */
const bridgeTerms = (items: ConfirmedBridgeItem[]) => items.map((i) => `${i.competency} ${i.target_requirement} ${i.user_note ?? ""}`).join(" ");
const bridgeNumbers = (items: ConfirmedBridgeItem[]) => items.map((i) => `${i.competency} ${i.user_note ?? ""}`).join(" ");
const bridgeNotes = (items: ConfirmedBridgeItem[]) => items.map((i) => i.user_note ?? "").join(" ");
const withExtra = (base: string, extra: string) => (extra.trim() ? `${base} ${extra}` : base);

/** A number, tool or employer the bullet asserts, and where it sits in the bullet. */
export interface Claim {
  text: string;
  start: number;
  end: number;
}

export interface Classification {
  provenance: ReviewProvenance;
  /** Claims the profile does not back up (empty unless provenance is new_claim). */
  missing: Claim[];
  /** Closest line the candidate wrote themselves, for Revert; "" when there is no clear source. */
  source: string;
}

const NUMBER = /(?<![A-Za-z\d.])\$?\d[\d,]*(?:\.\d+)?%?/g;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every string value anywhere in `value`, joined - a profile's shape can grow without this changing. */
function flatten(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flatten).join(" ");
  return "";
}

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9%$.\s]/g, " ").replace(/\s+/g, " ").trim();
const containsTerm = (haystack: string, term: string) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}(?![A-Za-z0-9])`, "i").test(haystack);

/** "Category: tool, tool" rows and plain skills, as single terms. */
export function vocabulary(resume: ResumeContent): string[] {
  const terms = [...resume.skills, ...resume.tools.flatMap((row) => row.replace(/^[^:]*:/, "").split(/[,;]/))];
  return [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))];
}

/** Numbers, resume tools/skills and resume employers mentioned in the bullet. Deterministic: no model. */
export function extractClaims(bullet: string, resume: ResumeContent): Claim[] {
  const claims: Claim[] = [];
  for (const m of bullet.matchAll(NUMBER)) claims.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  const named = [...vocabulary(resume), ...resume.experience.map((e) => e.company.trim()).filter((c) => c.length >= 2)];
  for (const term of named) {
    const m = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}(?![A-Za-z0-9])`, "i").exec(bullet);
    if (m) claims.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return claims.sort((a, b) => a.start - b.start);
}

function claimPresent(claim: Claim, corpus: string): boolean {
  if (/\d/.test(claim.text)) {
    // "40%" is backed by "40 percent" / "40 per cent"; only the digits have to match.
    const digits = claim.text.replace(/[$%,]/g, "");
    return new RegExp(`(?<![\\d.])${escapeRegex(digits)}(?![\\d]|\\.\\d)`).test(corpus.replace(/(\d),(?=\d)/g, "$1"));
  }
  return containsTerm(corpus, claim.text);
}

/** The candidate's own lines for a role, split so one can be matched to one bullet. */
function sourceLines(text: string): string[] {
  return text.split(/\n|[•·]|(?<=[.!?])\s+/).map((l) => l.trim()).filter((l) => l.length > 8);
}

function closestLine(bullet: string, lines: string[]): string {
  const target = new Set(words(bullet).split(" ").filter((w) => w.length > 2));
  let best = { line: "", score: 0 };
  for (const line of lines) {
    const set = new Set(words(line).split(" ").filter((w) => w.length > 2));
    const shared = [...set].filter((w) => target.has(w)).length;
    const score = shared / (new Set([...set, ...target]).size || 1);
    if (score > best.score) best = { line, score };
  }
  return best.score >= 0.35 ? best.line : "";
}

/**
 * Compares one bullet's numbers, tools and employers with the Career Profile.
 * - a claim the profile lacks: new_claim;
 * - every claim present and the wording is the candidate's own: profile;
 * - every claim present but the wording is new: reworded.
 * Numbers are checked against the matching role when the profile has it, else the whole profile.
 */
export function classifyBullet(
  bullet: string,
  profile: ProfileSource,
  resume: ResumeContent,
  roleIndex: number | null
): Classification {
  const role = roleIndex === null ? undefined : findSourceExperience(resume.experience[roleIndex], profile.work_experience, roleIndex);
  const { confirmed_bridge: confirmed = [], ...profileText } = profile;
  const profileFlat = flatten(profileText);
  // A number is only backed by the same role's evidence, so a note about one job cannot vouch for another's.
  const roleConfirmed = role
    ? confirmed.filter((i) => normalize(i.source_company) === normalize(role.company) && normalize(i.source_job_title) === normalize(role.job_title))
    : confirmed;
  const termText = withExtra(profileFlat, bridgeTerms(confirmed));
  const numberText = withExtra(role ? flatten(role) : profileFlat, bridgeNumbers(roleConfirmed));
  const ownText = withExtra(profileFlat, bridgeNotes(confirmed));

  const missing = extractClaims(bullet, resume).filter((c) => {
    const isNumber = /\d/.test(c.text);
    return !claimPresent(c, isNumber ? numberText : termText);
  });
  const lines = role ? sourceLines(role.description) : sourceLines(ownText);
  const source = closestLine(bullet, lines);
  if (missing.length > 0) return { provenance: "new_claim", missing, source };

  const own = words(ownText).includes(words(bullet)) && words(bullet).length > 0;
  return { provenance: own ? "profile" : "reworded", missing: [], source };
}

/** Bullets in experience/projects as Changes items; nothing for a bullet that is the candidate's own. */
export function provenanceItems(
  block: ReviewBlock,
  resume: ResumeContent,
  profile: ProfileSource | null
): RawReviewItem[] {
  const [kind, entry] = block.id.split(":");
  if (!profile || !block.text.trim() || (kind !== "experienceBullet" && kind !== "projectBullet")) return [];

  const result = classifyBullet(block.text, profile, resume, kind === "experienceBullet" ? Number(entry) : null);
  if (result.provenance === "profile") return [];

  if (result.provenance === "new_claim") {
    const { missing } = result;
    return [
      {
        kind: "change", ruleId: "provenance.new_claim", severity: "verify", provenance: "new_claim", blockId: block.id,
        start: missing[0].start, end: missing[missing.length - 1].end, before: result.source, after: block.text,
        reason: clampReason(`Not in your profile: ${missing.map((c) => c.text).join(", ")}. Is this true?`),
        claims: missing.map((c) => c.text), key: missing.map((c) => c.text.toLowerCase()).join("|"),
      },
    ];
  }
  return [
    {
      kind: "change", ruleId: "provenance.reworded", severity: "info", provenance: "reworded", blockId: block.id,
      start: 0, end: block.text.length, before: result.source, after: block.text,
      reason: "Nothing new added. Same numbers and tools as your profile.", key: "reworded",
    },
  ];
}
