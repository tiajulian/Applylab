import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";

const FEATURE = "parse-job-ad" as const;

/**
 * Compact, structured facts pulled from a raw job ad once. This is the shared "compact JD"
 * shape fed to the cheap, high-frequency Claude calls (assist, ats-score, cover-letter,
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
}

/** Below this length, an ad has nothing worth extracting - shared with the cache layer
 * (lib/resume/parsedJobAdCache.ts) so a near-empty ad skips the Claude call entirely rather than
 * spending a call on it and getting EMPTY_RESULT back anyway. */
export const MIN_JOB_AD_LENGTH = 20;

const MAX_AD_LENGTH = 20_000;
const MAX_FIELD_LENGTH = 200;
const MAX_LIST_ITEMS = 15;
const MAX_LIST_ITEM_LENGTH = 80;
const MAX_RESPONSIBILITY_ITEMS = 8;
const MAX_RESPONSIBILITY_LENGTH = 200;

const SYSTEM_PROMPT = `
You extract a compact, structured summary from a pasted job advertisement, for another
program to use as recruiter-facing job facts (not shown to the candidate verbatim).

Extract ONLY what is explicitly stated or unambiguously implied by the ad text. Never invent,
guess, or embellish a skill, tool, seniority level, or responsibility that isn't actually
there — an invented requirement here could later bias a candidate's resume toward claiming a
skill they don't have. If a field isn't clearly present in the ad, leave it empty (empty
string or empty array). Never pad a list to look complete.

Return ONLY valid JSON matching exactly this shape, no prose, no markdown code fences:
{
  "title": "",
  "company": "",
  "seniority": "",
  "must_have_skills": [],
  "nice_to_have_skills": [],
  "tools": [],
  "key_responsibilities": [],
  "keywords": []
}

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
`;

export const EMPTY_COMPACT_JOB_AD: CompactJobAd = {
  title: "",
  company: "",
  seniority: "",
  must_have_skills: [],
  nice_to_have_skills: [],
  tools: [],
  key_responsibilities: [],
  keywords: [],
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

/**
 * Best-effort extraction only — never throws on a malformed/empty model response, since this is
 * a non-blocking autofill helper for the New Resume form, not a generation step. A genuine API
 * failure (timeout, auth, network) still propagates so the caller can log it; the caller (the
 * route) is responsible for turning that into a quiet, non-scary failure for the client.
 */
export async function parseJobAd(adText: string, userId: string): Promise<CompactJobAd> {
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    // 8 fields including up to 15-item skill/tool/keyword lists and up to 8 responsibility
    // lines (200 chars each) - 768 was too tight for a long, detail-rich ad and risked a
    // mid-JSON truncation that fails JSON.parse and silently degrades to EMPTY_COMPACT_JOB_AD.
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: adText.slice(0, MAX_AD_LENGTH) }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    model: MODEL_BY_FEATURE[FEATURE],
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") return EMPTY_COMPACT_JOB_AD;

  try {
    const parsed = JSON.parse(extractJson(block.text)) as Record<string, unknown>;
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
    };
  } catch {
    return EMPTY_COMPACT_JOB_AD;
  }
}
