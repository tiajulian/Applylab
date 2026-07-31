import { anthropic, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";

export interface ParsedJobAd {
  title: string;
  company: string;
}

const MAX_AD_LENGTH = 20_000;
const MAX_FIELD_LENGTH = 200;

const SYSTEM_PROMPT = `
You extract the job title and hiring company name from a pasted job advertisement.

Return ONLY valid JSON matching exactly this shape, no prose, no markdown code fences:
{"title": "", "company": ""}

Use an empty string for either field if it isn't clearly stated in the ad. Never invent or guess
a title or company that isn't explicitly present in the text.
`;

const EMPTY_RESULT: ParsedJobAd = { title: "", company: "" };

/**
 * Best-effort extraction only — never throws on a malformed/empty model response, since this is
 * a non-blocking autofill helper for the New Resume form, not a generation step. A genuine API
 * failure (timeout, auth, network) still propagates so the caller can log it; the caller (the
 * route) is responsible for turning that into a quiet, non-scary failure for the client.
 */
export async function parseJobAd(adText: string, userId: string): Promise<ParsedJobAd> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL_FAST,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: adText.slice(0, MAX_AD_LENGTH) }],
  });

  await logApiCost({
    userId,
    feature: "parse-job-ad",
    model: CLAUDE_MODEL_FAST,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") return EMPTY_RESULT;

  try {
    const parsed = JSON.parse(extractJson(block.text)) as Record<string, unknown>;
    return {
      title: typeof parsed.title === "string" ? parsed.title.slice(0, MAX_FIELD_LENGTH) : "",
      company: typeof parsed.company === "string" ? parsed.company.slice(0, MAX_FIELD_LENGTH) : "",
    };
  } catch {
    return EMPTY_RESULT;
  }
}
