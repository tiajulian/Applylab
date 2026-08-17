import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";

const FEATURE = "win-starters" as const;
const MAX_STARTERS = 4;

/**
 * Description rung of the Win Builder's personalisation ladder (Part F). Only reached when a
 * role's own free-text description has real content but a plain line-split (see
 * lib/wins/starterLadder.ts#splitDescriptionBullets) couldn't cleanly pull 2+ bullets out of it -
 * e.g. it's a dense paragraph rather than line-separated notes. Extraction only, never invention:
 * every phrase returned must be a short paraphrase of something already in the candidate's own
 * notes, never a new task, tool, or outcome.
 */
const SYSTEM_PROMPT = `
You help a candidate pick a starting point for describing one win from a role, by pulling short
phrases out of raw notes they already wrote about that role - never inventing anything new.

THE RULE THAT GOVERNS EVERYTHING: EXTRACT, NEVER INVENT.
Every phrase you return must be a short, recognisable paraphrase of something that is actually
stated in the notes below. Never add a task, tool, outcome, or detail that isn't in the notes,
even a plausible-sounding one. If the notes don't clearly describe ${MAX_STARTERS} distinct
things, return fewer - it is fine to return just one or two, or none at all.

FOR EACH PHRASE:
- Keep it short (under 12 words), plain, and concrete - something the candidate would recognise
  as their own work if they saw it as a tap-to-use starting point.
- Do not add a number, outcome, or judgement ("successfully", "efficiently") that isn't already
  in the notes - a starter is just a short label for "the thing you did", not a finished bullet.

Return ${MAX_STARTERS} phrases at most.

FORMAT RULES: Australian English spelling. Never use em dashes (—) or en dashes (–); use a comma,
hyphen, or parentheses instead.

Return ONLY a valid JSON object with this exact structure, no markdown backticks, no preamble:
{
  "starters": [""]
}
`;

/** Best-effort: any failure (parse error, unexpected response shape) yields an empty list rather
 * than throwing, so the caller just falls through to the next rung of the ladder. */
export async function extractWinStarters(description: string, userId: string): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `ROLE NOTES:\n${description}` }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    model: MODEL_BY_FEATURE[FEATURE],
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") return [];

  try {
    const result = sanitizeDeep(JSON.parse(extractJson(block.text)) as { starters?: string[] });
    return (result.starters ?? [])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, MAX_STARTERS);
  } catch {
    return [];
  }
}
