import { Type } from "@google/genai";
import { callGateway, gemini, geminiOutputTokens } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { extractJson } from "@/lib/anthropic/json";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { cleanStringList } from "@/lib/text/cleanStringList";
import type { createClient } from "@/lib/supabase/server";
import { MAX_PICK_LINES } from "@/lib/profile/pickOptions";
import type { Plan } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

// Its own feature name, never "assist": the hourly polish caps count "assist" rows, and this
// free helper step before "Improve all the wording" must not use them up.
const FEATURE = "line-picks" as const;
// Same small, fast model as the other single-text helpers (assistBullet.ts).
const PROVIDER = MODEL_BY_FEATURE.assist.provider;
const MODEL = MODEL_BY_FEATURE.assist.model;

export { MAX_PICK_LINES };
const MAX_TOOLS = 4;
const MAX_STAKEHOLDERS = 3;
const MAX_PICK_LENGTH = 40;

export interface LinePicks {
  tools: string[];
  stakeholders: string[];
}

const SYSTEM_PROMPT = `
You help a candidate make their resume lines specific. For each numbered line, suggest tools and
people they might have worked with, which they can tap to confirm. These are only suggestions shown
as choices; never rewrite the line.

Decide per line, never by default:
- "tools": up to ${MAX_TOOLS} tools or systems someone in this role would likely use for THIS line's
  work (e.g. "SQL", "Excel", "Power BI" for a reporting line). Empty when the work isn't done with a
  tool or system, or when the line already names one.
- "stakeholders": up to ${MAX_STAKEHOLDERS} people or teams the work was likely for or with (e.g.
  "Finance team", "Store manager", "Customers"). Empty when the work isn't for or with other people,
  or when the line already names who.
Most lines need one of the two, some need both, some need neither. Only suggest where it would
clearly make the line more specific - when unsure, leave the list empty. Never suggest a person or
team that restates one the line already names (e.g. "new analysts" -> no "Junior analysts").
Keep each pick to 1-4 words.
Australian English. Never use em dashes.

Return a JSON array with exactly one object per line, in the same order:
[{ "tools": [], "stakeholders": [] }]
`;

/**
 * Likely tools and people/teams for each resume line, offered as tap-to-confirm picks before
 * "Improve all the wording" rewrites them. One short AI call for the whole batch; a line that
 * doesn't need picks (or already names them) comes back empty.
 */
export async function suggestLinePicks(
  lines: string[],
  context: { jobTitle: string; company?: string },
  options: { userId: string; supabase: SupabaseServerClient; tier: Plan }
): Promise<LinePicks[]> {
  const batch = lines.slice(0, MAX_PICK_LINES);
  if (batch.length === 0) return [];
  const { userId, supabase, tier } = options;

  const response = await callGateway({
    supabase,
    userId,
    tier,
    feature: FEATURE,
    provider: PROVIDER,
    model: MODEL,
    estimatedCredits: 8,
    shadow: true,
    invoke: () =>
      gemini.models.generateContent({
        model: MODEL,
        contents: `Role: ${[context.jobTitle, context.company].filter(Boolean).join(" at ") || "N/A"}\n\nLines:\n${batch
          .map((line, i) => `${i + 1}. ${line}`)
          .join("\n")}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.2,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 1 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tools: { type: Type.ARRAY, items: { type: Type.STRING } },
                stakeholders: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["tools", "stakeholders"],
            },
          },
        },
      }),
    extractUsage: (result) => ({
      inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: geminiOutputTokens(result.usageMetadata),
    }),
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    provider: PROVIDER,
    model: MODEL,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: geminiOutputTokens(response.usageMetadata),
  });

  return normalizeLinePicks(JSON.parse(extractJson(response.text ?? "[]")), batch.length);
}

/** Exactly `count` entries, each a cleaned and capped pair of lists - missing or junk entries become empty. */
export function normalizeLinePicks(value: unknown, count: number): LinePicks[] {
  const raw = Array.isArray(value) ? sanitizeDeep(value as unknown[]) : [];
  return Array.from({ length: count }, (_, i) => {
    const entry = raw[i] as Partial<Record<keyof LinePicks, unknown>> | undefined;
    return {
      tools: cleanStringList(entry?.tools, { maxItems: MAX_TOOLS, maxItemLength: MAX_PICK_LENGTH }),
      stakeholders: cleanStringList(entry?.stakeholders, { maxItems: MAX_STAKEHOLDERS, maxItemLength: MAX_PICK_LENGTH }),
    };
  });
}
