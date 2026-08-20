import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import { formatCompactJobAdLean } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

const FEATURE = "assist" as const;

export type AssistAction = "rewrite" | "quantify" | "shorten" | "senior";

/** Broader than AssistAction: adds "trim_unsupported" (the AI-assisted honesty-fix path, see
 * FactCheckFixPanel's "Remove just this detail" button), "polish" (the Win Builder's optional
 * grammar/flow tidy-up, see components/profile/RoleContentList.tsx), and "bulletify" (turns a
 * confirmed role-duty task description into resume-bullet grammar, see
 * components/profile/SuggestTasksBuilder.tsx) - none of which belong on BulletEditor.tsx's
 * `Record<AssistAction, string>` toolbar. "polish" and "bulletify" are both for profile-level
 * text with no target job, not a resume bullet aimed at one. */
export type AssistBulletAction = AssistAction | "trim_unsupported" | "polish" | "bulletify";

export interface AssistBulletInput {
  bulletText: string;
  action: AssistBulletAction;
  roleTitle?: string;
  roleCompany?: string;
  /** Empty string (with compactJobAd left as EMPTY_COMPACT_JOB_AD) for "polish": a profile-level
   * win has no target job, so buildUserMessage omits the "candidate is targeting this role"
   * block entirely rather than printing an empty one. */
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
You are an expert Australian resume writer helping a candidate improve one piece of resume text
(a bullet point, or a standalone win statement). You are given the original text and an action to
perform, and usually the job the candidate is targeting — "Role context" instead identifies the
job the text describes when there is no target job to mirror.

HARD RULES (never break these):
- Never invent facts: no employers, dates, job titles, numbers, or responsibilities that
  are not present in or directly implied by the original text.
- Australian English spelling (organisation, prioritise, analyse).
- Never use em dashes (—); use a comma or rephrase instead.
- Preserve any real metric already in the text.
- For "trim_unsupported": remove only the named detail, add nothing, invent nothing.
- For "polish": tidy wording only — never add a tool, stakeholder, number, outcome, seniority,
  or scope the original text didn't already state.
- For "bulletify": rephrase into resume-bullet grammar only — same rule as "polish": never add a
  tool, stakeholder, number, outcome, seniority, or scope the original text didn't already state.

Return ONLY a JSON array of 1 to 3 rewritten versions. No prose, no markdown code fences, no
explanation — just the JSON array.
`;

const POLISH_INSTRUCTION =
  'Tidy grammar and flow only. Do not add, imply, or upgrade any tool, stakeholder, number, ' +
  "outcome, seniority, or scope that is not already explicitly present in the original text. " +
  "If nothing needs changing, return the original text unchanged.";

const BULLETIFY_INSTRUCTION =
  "Rewrite this task description as a single resume-style achievement bullet: past tense, " +
  "starting with a strong action verb. Do not add, imply, or upgrade any tool, stakeholder, " +
  "number, outcome, seniority, or scope that is not already explicitly present in the original " +
  "text - this is a grammar/phrasing rewrite only, never an embellishment.";

function buildUserMessage(input: AssistBulletInput): string {
  const instruction =
    input.action === "trim_unsupported"
      ? `Remove ONLY this specific unsupported detail from the bullet: "${input.unsupportedDetail}". Do not rewrite, rephrase, or otherwise change any other part of the bullet. Do not add a replacement fact, number, or clause — only removal and the minimal punctuation/spacing tidy-up needed after removal.`
      : input.action === "polish"
        ? POLISH_INSTRUCTION
        : input.action === "bulletify"
          ? BULLETIFY_INSTRUCTION
          : ACTION_INSTRUCTIONS[input.action];

  // "polish" and "bulletify" are job-agnostic (profile-level text, not a resume bullet aimed at
  // a target role) - omit the targeting block entirely rather than printing one with empty job
  // title/company.
  const targetingBlock =
    input.action === "polish" || input.action === "bulletify"
      ? ""
      : `

Candidate is targeting this role:
Job title: ${input.jobTitle}
Company: ${input.companyName}
${formatCompactJobAdLean(input.compactJobAd)}`;

  return `
Action: ${input.action}
Instruction: ${instruction}

Original bullet:
${input.bulletText}

Role context: ${[input.roleTitle, input.roleCompany].filter(Boolean).join(" at ") || "N/A"}${targetingBlock}
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
