import { claimPresent, findClaims, type Claim } from "@/lib/review/provenance";
import { TOOL_CATALOG } from "@/lib/wins/toolCatalog";

/**
 * Section 8.4 honesty check: no suggested answer or follow-up may add a number, tool or employer
 * the candidate hasn't logged (profile, tailored resume) or said themselves (this transcript).
 * Deterministic, same claim matching as the resume review (lib/review/provenance.ts), so
 * "40 percent" backs "40%".
 */

export type ClaimType = "number" | "tool" | "employer";

export interface TypedClaim extends Claim {
  type: ClaimType;
}

export interface HonestyContext {
  /** Everything the candidate has logged or said; a claim found here is theirs. */
  allowedText: string;
  /** Tool names to look for; an AI can only invent a tool it names. */
  terms: string[];
}

/** Catalog tools that are also everyday words ("go live", "a square", "zoom in"): matching them
 *  would flag ordinary sentences as invented tools, so they are left out of detection. */
const EVERYDAY_WORDS = new Set(
  [
    "Box", "Mode", "R", "Go", "Linear", "Segment", "Buffer", "Outreach", "Square", "Lever", "Toast", "Compass",
    "Epic", "Forklift", "Deputy", "Workday", "Concur", "Clover", "Swift", "React", "Sketch", "Slack", "Zoom",
    "Notion", "Rust", "Ruby", "Sage", "Gong", "Lattice", "Unleashed", "Vend", "Stripe", "Bash", "Greenhouse",
    "Lightspeed", "Rhino", "Claude", "Amplitude", "Seesaw", "Micros", "Five9", "Genesys", "Apollo.io", "Kahoot!",
  ].map((w) => w.toLowerCase())
);

const KNOWN_TOOLS: string[] = TOOL_CATALOG.filter((t) => !EVERYDAY_WORDS.has(t.toLowerCase()));

function flatten(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(flatten).join(" ");
  return "";
}

export function buildHonestyContext(sources: unknown[], extraTerms: string[] = []): HonestyContext {
  return {
    allowedText: sources.map(flatten).join("\n"),
    terms: [...new Set([...KNOWN_TOOLS, ...extraTerms.filter((t) => t.trim().length >= 2)])],
  };
}

/** Capitalised words after "at/for/with" that are not employers: sentence glue and team names. */
const NOT_EMPLOYERS = new Set([
  "the", "a", "an", "this", "that", "my", "our", "their", "first", "last", "least", "most", "work", "home", "i",
  "finance", "marketing", "sales", "hr", "it", "legal", "operations", "product", "engineering", "support",
  "customers", "management", "leadership", "senior", "executive", "board", "design", "data", "procurement",
]);

/**
 * Employers can't come from a fixed list, so look for the phrasing that names one: "at X",
 * "for X", "joined X", "with X" followed by a capitalised name. A name the candidate logged or
 * said is fine; any other is treated as invented.
 */
function employerClaims(text: string): TypedClaim[] {
  const out: TypedClaim[] = [];
  // A name is capitalised words ("Bank of Queensland" stops at "of"; good enough), never running
  // past a full stop or into "I", and a dot only inside a word ("Monday.com").
  const word = "[A-Z](?:[\\w&'-]|\\.(?=\\w))*";
  const re = new RegExp(`\\b(?:at|for|joined|with)\\s+(${word}(?:\\s+(?!I\\b)${word}){0,3})`, "g");
  for (const m of text.matchAll(re)) {
    const name = m[1].replace(/[.'-]+$/, "");
    if (name.length < 3 || NOT_EMPLOYERS.has(name.split(/\s+/)[0].toLowerCase())) continue;
    const start = m.index + m[0].length - m[1].length;
    out.push({ text: name, start, end: start + name.length, type: "employer" });
  }
  return out;
}

/** Claims in `text` the context doesn't back, without overlaps (longest match wins). */
export function newClaims(text: string, ctx: HonestyContext): TypedClaim[] {
  const found: TypedClaim[] = [
    ...findClaims(text, ctx.terms).map((c) => ({ ...c, type: (/\d/.test(c.text) ? "number" : "tool") as ClaimType })),
    ...employerClaims(text),
  ];
  const missing = found.filter((c) => !claimPresent(c, ctx.allowedText));
  const sorted = [...missing].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: TypedClaim[] = [];
  for (const c of sorted) {
    if (out.length && c.start < out[out.length - 1].end) continue;
    out.push(c);
  }
  return out;
}

const PLACEHOLDER: Record<ClaimType, string> = {
  number: "[your real number]",
  tool: "[your real tool]",
  employer: "[your real employer]",
};

/** Swaps each unbacked claim for a visible placeholder the candidate fills with the truth. */
export function replaceClaims(text: string, claims: TypedClaim[]): string {
  let out = text;
  for (const c of [...claims].sort((a, b) => b.start - a.start)) {
    out = `${out.slice(0, c.start)}${PLACEHOLDER[c.type]}${out.slice(c.end)}`;
  }
  return out;
}

export interface HonestyResult {
  suggestedAnswer: string;
  /** null when the follow-up would have named something the candidate never mentioned. */
  followupQuestion: string | null;
  claimTypes: ClaimType[];
}

/**
 * Checks the stronger version and the follow-up. A suggested answer with new claims is rewritten
 * once (`rewrite`, told exactly what to drop); anything still there becomes a placeholder. A
 * follow-up with a new claim is dropped rather than asked.
 */
export async function enforceHonesty(
  input: {
    suggestedAnswer: string;
    followupQuestion: string | null;
    /** A follow-up may repeat what the question itself asked about (e.g. a tool from the job
     *  ad); the stronger version may not, since that would claim the candidate used it. */
    questionText: string;
  },
  ctx: HonestyContext,
  rewrite: (text: string, banned: string[]) => Promise<string | null>
): Promise<HonestyResult> {
  const claimTypes = new Set<ClaimType>();
  let suggestedAnswer = input.suggestedAnswer;

  const firstPass = newClaims(suggestedAnswer, ctx);
  if (firstPass.length > 0) {
    firstPass.forEach((c) => claimTypes.add(c.type));
    const rewritten = await rewrite(suggestedAnswer, [...new Set(firstPass.map((c) => c.text))]).catch(() => null);
    if (rewritten?.trim()) suggestedAnswer = rewritten.trim();
    const leftover = newClaims(suggestedAnswer, ctx);
    if (leftover.length > 0) suggestedAnswer = replaceClaims(suggestedAnswer, leftover);
  }

  let followupQuestion = input.followupQuestion;
  if (followupQuestion) {
    const followupClaims = newClaims(followupQuestion, {
      ...ctx,
      allowedText: `${ctx.allowedText}\n${input.questionText}`,
    });
    if (followupClaims.length > 0) {
      followupClaims.forEach((c) => claimTypes.add(c.type));
      followupQuestion = null;
    }
  }

  if (claimTypes.size > 0) {
    // Claim types only, never content (section 8.4 monitoring).
    console.warn("interview_honesty_violation", { claim_types: [...claimTypes] });
  }

  return { suggestedAnswer, followupQuestion, claimTypes: [...claimTypes] };
}
