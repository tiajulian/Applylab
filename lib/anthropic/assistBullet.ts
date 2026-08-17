import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import { formatCompactJobAdLean } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

const FEATURE = "assist" as const;

export type AssistAction = "rewrite" | "quantify" | "shorten" | "senior";

/** Broader than AssistAction: adds "trim_unsupported", the AI-assisted honesty-fix path (see
 * FactCheckFixPanel's "Remove just this detail" button) that removes one named unsupported detail
 * from a bullet rather than performing one of the four editor toolbar actions above. Kept as a
 * separate type rather than folded into AssistAction itself, since AssistAction drives
 * BulletEditor.tsx's `Record<AssistAction, string>` toolbar - adding "trim_unsupported" there
 * would force an unwanted extra button onto that unrelated toolbar. */
export type AssistBulletAction = AssistAction | "trim_unsupported";

export interface AssistBulletInput {
  bulletText: string;
  action: AssistBulletAction;
  roleTitle?: string;
  roleCompany?: string;
  jobTitle: string;
  companyName: string;
  compactJobAd: CompactJobAd;
  /** Required when action is "trim_unsupported" - the exact unsupported phrase/figure to remove,
   * verbatim from the honesty flag's `value`. */
  unsupportedDetail?: string;
}

export class AssistBulletError extends Error {}

const ACTION_INSTRUCTIONS: Record<AssistAction, string> = {
  rewrite:
    "Rewrite the bullet for clarity and professionalism. Keep the same underlying facts and meaning — just express them better.",
  quantify:
    "Surface where impact or scale belongs in this bullet. If the original text already contains a real number, sharpen how it's presented. If it does NOT contain a real metric, do NOT invent one — insert a clearly editable placeholder such as \"[add %/number]\" exactly where a metric would strengthen the bullet, so the candidate can fill in the real figure themselves.",
  shorten: "Tighten the wording. Keep the same meaning and any facts/metrics present, but make it noticeably more concise.",
  senior:
    "Reframe the bullet with more senior, ownership-oriented language (e.g. \"led\", \"owned\", \"drove\") without adding responsibilities, scope, or outcomes that are not implied by the original text.",
};

const ASSIST_SYSTEM_PROMPT = `
You are an expert Australian resume writer helping a candidate improve a single resume
bullet point. You are given the original bullet, an action to perform, and the job the
candidate is targeting.

HARD RULES (never break these):
- Never invent facts: no employers, dates, job titles, numbers, or responsibilities that
  are not present in or directly implied by the original bullet.
- Australian English spelling (organisation, prioritise, analyse).
- Never use em dashes (—); use a comma or rephrase instead.
- Preserve any real metric already in the bullet.
- For "trim_unsupported": remove only the named detail, add nothing, invent nothing.

Return ONLY a JSON array of 1 to 3 rewritten bullet strings. No prose, no markdown code
fences, no explanation — just the JSON array.
`;

function buildUserMessage(input: AssistBulletInput): string {
  const instruction =
    input.action === "trim_unsupported"
      ? `Remove ONLY this specific unsupported detail from the bullet: "${input.unsupportedDetail}". Do not rewrite, rephrase, or otherwise change any other part of the bullet. Do not add a replacement fact, number, or clause — only removal and the minimal punctuation/spacing tidy-up needed after removal.`
      : ACTION_INSTRUCTIONS[input.action];

  return `
Action: ${input.action}
Instruction: ${instruction}

Original bullet:
${input.bulletText}

Role context: ${[input.roleTitle, input.roleCompany].filter(Boolean).join(" at ") || "N/A"}

Candidate is targeting this role:
Job title: ${input.jobTitle}
Company: ${input.companyName}
${formatCompactJobAdLean(input.compactJobAd)}
`.trim();
}

export async function assistBullet(input: AssistBulletInput, userId: string): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 1024,
    system: ASSIST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    model: MODEL_BY_FEATURE[FEATURE],
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new AssistBulletError("Unexpected response type from Claude");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(block.text));
  } catch {
    throw new AssistBulletError("Could not parse the rewritten bullet options");
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((v) => typeof v === "string")) {
    throw new AssistBulletError("Could not parse the rewritten bullet options");
  }

  return parsed.slice(0, 3).map(sanitizeDashes);
}
