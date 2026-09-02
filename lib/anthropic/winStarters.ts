import { Type } from "@google/genai";
import { gemini, geminiOutputTokens } from "@/lib/gemini/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
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
`;

const WIN_STARTERS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    starters: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["starters"],
};

/** Best-effort: any failure (parse error, unexpected response shape) yields an empty list rather
 * than throwing, so the caller just falls through to the next rung of the ladder. */
export async function extractWinStarters(description: string, userId: string): Promise<string[]> {
  const response = await gemini.models.generateContent({
    model: MODEL_BY_FEATURE[FEATURE].model,
    contents: `ROLE NOTES:\n${description}`,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 512,
      // Extracting a few short phrases is a simple, fast task - not worth the latency of the
      // model's default thinking budget (measured 50s+ per call with thinking on).
      // thinkingBudget: 0 (fully disabled) returns a 400 on this model - confirmed live during
      // implementation - so 1 is the practical floor.
      thinkingConfig: { thinkingBudget: 1 },
      responseMimeType: "application/json",
      responseSchema: WIN_STARTERS_SCHEMA,
    },
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model: MODEL_BY_FEATURE[FEATURE].model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    // See geminiOutputTokens for why this isn't just candidatesTokenCount (undercounted this
    // feature's real cost, even at thinkingBudget: 1 - thinking still runs; the budget isn't a
    // hard cap).
    outputTokens: geminiOutputTokens(response.usageMetadata),
  });

  const text = response.text;
  if (!text) return [];

  try {
    const result = sanitizeDeep(JSON.parse(text) as { starters?: string[] });
    return (result.starters ?? [])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, MAX_STARTERS);
  } catch {
    return [];
  }
}
