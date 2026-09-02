import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";

const FEATURE = "parse-job-ad" as const;

export type ClosesAtState = "unknown" | "absolute" | "relative" | "absent";

/**
 * Compact, structured facts pulled from a raw job ad once. This is the shared "compact JD"
 * shape fed to the cheap, high-frequency calls (assist, ats-score, cover-letter,
 * retailor) instead of the full ad text — see lib/resume/parsedJobAdCache.ts for the
 * hash-keyed cache that lets a given ad only ever go through this extraction once.
 * generate-resume and skills-bridge stay on the full raw ad; they don't consume this type.
 */
export interface CompactJobAd {
  title: string;
  company: string;
  seniority: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  tools: string[];
  key_responsibilities: string[];
  keywords: string[];
  /** 0-4 short, distinctive facts about the role/team/company that must_have_skills/
   * key_responsibilities don't capture (e.g. "first hire for a new team", "follow-the-sun
   * on-call with an overseas team") - see interview-question-gen for why this exists: a live
   * test found it let question generation reference genuinely specific detail using fewer
   * tokens than resending the full raw ad text on every call, and more reliably than hoping the
   * model notices the detail buried in 3000 characters of raw text. */
  notable_context: string[];
  closes_at?: string | null;
  closes_at_state?: ClosesAtState;
  closes_at_source?: string | null;
}

/** Below this length, an ad has nothing worth extracting - shared with the cache layer
 * (lib/resume/parsedJobAdCache.ts) so a near-empty ad skips the AI call entirely rather than
 * spending a call on it and getting EMPTY_RESULT back anyway. */
export const MIN_JOB_AD_LENGTH = 20;

const MAX_AD_LENGTH = 20_000;
const MAX_FIELD_LENGTH = 200;
const MAX_LIST_ITEMS = 15;
const MAX_LIST_ITEM_LENGTH = 80;
const MAX_RESPONSIBILITY_ITEMS = 8;
const MAX_RESPONSIBILITY_LENGTH = 200;
const MAX_NOTABLE_CONTEXT_ITEMS = 4;
const MAX_NOTABLE_CONTEXT_LENGTH = 150;

const SYSTEM_PROMPT = `
You extract a compact, structured summary from a pasted job advertisement, for another
program to use as recruiter-facing job facts (not shown to the candidate verbatim).

Extract ONLY what is explicitly stated or unambiguously implied by the ad text. Never invent,
guess, or embellish a skill, tool, seniority level, or responsibility that isn't actually
there — an invented requirement here could later bias a candidate's resume toward claiming a
skill they don't have. If a field isn't clearly present in the ad, leave it empty (empty
string or empty array). Never pad a list to look complete.

Field notes:
- "title" / "company": the job title and hiring company. Empty string if either isn't clearly
  stated.
- "seniority": one short word/phrase for the level the ad asks for (e.g. "junior", "mid",
  "senior", "lead", "manager"). Empty string if the ad doesn't indicate a level.
- "must_have_skills": skills, qualifications, or experience the ad states as required or
  essential. Short plain terms, not full sentences.
- "nice_to_have_skills": skills the ad calls out as preferred, desirable, or a bonus — not
  required.
- "tools": named software, platforms, systems, or technologies mentioned in the ad.
- "key_responsibilities": up to 6 short paraphrased lines (not verbatim ad text) capturing
  what the role actually does day to day.
- "keywords": other recruiter/ATS-relevant terms from the ad worth mirroring (domain terms,
  certifications, methodologies) not already covered by the fields above.
- "notable_context": 0 to 4 short, DISTINCTIVE facts about this specific role, team, or company
  that a generic skills/responsibilities list would NOT capture - things like an unusual team
  structure ("first hire for a new team"), a distinctive workflow ("follow-the-sun on-call with
  an overseas team"), a named cultural practice ("blameless postmortem culture"), or anything
  else that would make a genuinely good, specific interview question. Do NOT restate anything
  already covered by must_have_skills or key_responsibilities. Leave empty if the ad has nothing
  distinctive beyond a standard skills/responsibilities list - never force an entry.
- "closes_at": The application closing date in YYYY-MM-DD format if present in the ad.
  Australian date convention applies: DD/MM/YYYY (e.g. 12/09/2026 is 12 September 2026, not 9 December).
  If an ad has multiple dates ("closes 12 Sep, interviews 20 Sep"), take the APPLICATION CLOSING date.
  Empty string if absent.
- "closes_at_state": One of:
  * "absolute": An explicit date in the ad ("Applications close 12 September 2026").
  * "relative": A relative statement ("closes in 14 days", "closes in 2 weeks").
  * "absent": No closing date information in the ad. Do not guess from "urgent" or "immediate start".
- "closes_at_source": If closes_at_state is "relative", store the verbatim relative phrase from the ad (e.g. "closes in 14 days"). Otherwise empty string.
`;

const JOB_AD_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    company: { type: "string" },
    seniority: { type: "string" },
    must_have_skills: { type: "array", items: { type: "string" } },
    nice_to_have_skills: { type: "array", items: { type: "string" } },
    tools: { type: "array", items: { type: "string" } },
    key_responsibilities: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    notable_context: { type: "array", items: { type: "string" } },
    closes_at: { type: "string" },
    closes_at_state: {
      type: "string",
      enum: ["unknown", "absolute", "relative", "absent"],
    },
    closes_at_source: { type: "string" },
  },
  required: [
    "title",
    "company",
    "seniority",
    "must_have_skills",
    "nice_to_have_skills",
    "tools",
    "key_responsibilities",
    "keywords",
    "notable_context",
    "closes_at",
    "closes_at_state",
    "closes_at_source",
  ],
  additionalProperties: false,
};

export const EMPTY_COMPACT_JOB_AD: CompactJobAd = {
  title: "",
  company: "",
  seniority: "",
  must_have_skills: [],
  nice_to_have_skills: [],
  tools: [],
  key_responsibilities: [],
  keywords: [],
  notable_context: [],
  closes_at: null,
  closes_at_state: "absent",
  closes_at_source: null,
};

function sanitizeField(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_FIELD_LENGTH) : "";
}

function sanitizeList(value: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxItemLength));
}

function sanitizeClosesAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // Expect YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function sanitizeClosesAtState(value: unknown): ClosesAtState {
  if (typeof value === "string" && ["unknown", "absolute", "relative", "absent"].includes(value)) {
    return value as ClosesAtState;
  }
  return "absent";
}

/**
 * Best-effort extraction only — never throws on a malformed/empty model response, since this is
 * a non-blocking autofill helper for the New Resume form, not a generation step. A genuine API
 * failure (timeout, auth, network) still propagates so the caller can log it; the caller (the
 * route) is responsible for turning that into a quiet, non-scary failure for the client.
 */
export async function parseJobAd(adText: string, userId: string): Promise<CompactJobAd> {
  const response = await openai.chat.completions.create({
    model: MODEL_BY_FEATURE[FEATURE].model,
    temperature: 0,
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: { name: "parsed_job_ad", strict: true, schema: JOB_AD_JSON_SCHEMA },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: adText.slice(0, MAX_AD_LENGTH) },
    ],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model: MODEL_BY_FEATURE[FEATURE].model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return EMPTY_COMPACT_JOB_AD;

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const closesAt = sanitizeClosesAt(parsed.closes_at);
    const closesAtState = sanitizeClosesAtState(parsed.closes_at_state);
    const closesAtSource = typeof parsed.closes_at_source === "string" && parsed.closes_at_source.trim()
      ? parsed.closes_at_source.trim().slice(0, MAX_FIELD_LENGTH)
      : null;

    return {
      title: sanitizeField(parsed.title),
      company: sanitizeField(parsed.company),
      seniority: sanitizeField(parsed.seniority),
      must_have_skills: sanitizeList(parsed.must_have_skills, MAX_LIST_ITEMS, MAX_LIST_ITEM_LENGTH),
      nice_to_have_skills: sanitizeList(parsed.nice_to_have_skills, MAX_LIST_ITEMS, MAX_LIST_ITEM_LENGTH),
      tools: sanitizeList(parsed.tools, MAX_LIST_ITEMS, MAX_LIST_ITEM_LENGTH),
      key_responsibilities: sanitizeList(
        parsed.key_responsibilities,
        MAX_RESPONSIBILITY_ITEMS,
        MAX_RESPONSIBILITY_LENGTH
      ),
      keywords: sanitizeList(parsed.keywords, MAX_LIST_ITEMS, MAX_LIST_ITEM_LENGTH),
      notable_context: sanitizeList(parsed.notable_context, MAX_NOTABLE_CONTEXT_ITEMS, MAX_NOTABLE_CONTEXT_LENGTH),
      closes_at: closesAt,
      closes_at_state: closesAt ? closesAtState : (closesAtState === "relative" ? "relative" : "absent"),
      closes_at_source: closesAtSource,
    };
  } catch {
    return EMPTY_COMPACT_JOB_AD;
  }
}
