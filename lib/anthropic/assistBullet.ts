import { Type } from "@google/genai";
import { callGateway, gemini, geminiOutputTokens } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import { formatCompactJobAdLean } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import type { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

// One feature name shared by all three real call sites (resume-assist, win-polish, role-duties/
// generate-achievements - see each route's own comment) - this is deliberate, not an oversight.
// Every one of them ends up here, so gating on this single FEATURE string under one per-user
// credit pool is exactly what closes the "double budget" gap: today, resume-assist's per-resume
// reserveAssistCall and win-polish/generate-achievements' independent hourly soft-caps are three
// unrelated meters for what the credit pool will treat as one spend. Shadow mode surfaces that
// real, combined spend in the ledger without touching any of those three gates yet.
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
  isCurrentRole?: boolean;
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
- For "bulletify": rephrase plain or informal duties into strong, professional resume-bullet grammar starting with an active action verb while preserving factual accuracy.

Return 1 to 3 rewritten versions of the bullet.
`;

const POLISH_INSTRUCTION =
  'Tidy grammar and flow only. Do not add, imply, or upgrade any tool, stakeholder, number, ' +
  "outcome, seniority, or scope that is not already explicitly present in the original text. " +
  "If nothing needs changing, return the original text unchanged.";

function getPolishInstruction(isCurrentRole?: boolean): string {
  const tenseRule = isCurrentRole
    ? "Enforce active PRESENT tense (e.g., Engineers, Optimises, Coordinates) because this is a current role."
    : "Enforce active PAST tense (e.g., Engineered, Optimised, Coordinated) because this is a past role.";
  return `${POLISH_INSTRUCTION} ${tenseRule} Return 3 variations: [1. Action-First balanced version, 2. Metric-First front-loaded version, 3. Concise 1-line version].`;
}

function getBulletifyInstruction(isCurrentRole?: boolean): string {
  const tenseRule = isCurrentRole
    ? "Enforce active PRESENT tense (e.g., Prepares, Coordinates, Manages, Spearheads) because this is a current role."
    : "Enforce active PAST tense (e.g., Prepared, Coordinated, Managed, Spearheaded) because this is a past role.";
  return `Elevate and rewrite this task description into a polished, professional resume achievement bullet starting with a strong action verb. Rephrase informal, brief, or plain duties into clear, professional workplace achievements while maintaining factual accuracy. ${tenseRule}`;
}

function buildUserMessage(input: AssistBulletInput): string {
  const instruction =
    input.action === "trim_unsupported"
      ? `Remove ONLY this specific unsupported detail from the bullet: "${input.unsupportedDetail}". Do not rewrite, rephrase, or otherwise change any other part of the bullet. Do not add a replacement fact, number, or clause — only removal and the minimal punctuation/spacing tidy-up needed after removal.`
      : input.action === "polish"
        ? getPolishInstruction(input.isCurrentRole)
        : input.action === "bulletify"
          ? getBulletifyInstruction(input.isCurrentRole)
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

export async function assistBullet(
  input: AssistBulletInput,
  userId: string,
  supabase: SupabaseServerClient,
  tier: Plan
): Promise<string[]> {
  const response = await callGateway({
    supabase,
    userId,
    tier,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model: MODEL_BY_FEATURE[FEATURE].model,
    // Conservative worst case at Gemini Flash pricing ($0.75/$3.75 per million): maxOutputTokens
    // (1024) alone is ~4 credits at $0.001/credit, plus headroom for a longer bullet/job-ad
    // context in the prompt. Real cost (usually well under this for a single short bullet)
    // replaces the estimate at commit time regardless (creditsFromCostUsd).
    estimatedCredits: 8,
    // Shadow mode (see GatewayCallParams.shadow): none of the three real gates on this feature
    // (resume-assist's reserveAssistCall, win-polish's and generate-achievements' independent
    // hourly soft-caps) are replaced yet - this call can never refuse on its own. The point right
    // now is the ledger: one shared "assist" feature row per call, from whichever entry point,
    // so the real combined spend across all three is visible before any of them is repointed at
    // the credit pool as the actual gate.
    shadow: true,
    invoke: () =>
      gemini.models.generateContent({
        model: MODEL_BY_FEATURE[FEATURE].model,
        contents: buildUserMessage(input),
        config: {
          systemInstruction: ASSIST_SYSTEM_PROMPT,
          temperature: 0.3,
          maxOutputTokens: 1024,
          // Rewriting one bullet is a simple, fast task - not worth the latency of the model's
          // default thinking budget (measured 30s+ per call with thinking on). thinkingBudget: 0
          // (fully disabled) returns a 400 on this model - confirmed live during implementation -
          // so 1 is the practical floor.
          thinkingConfig: { thinkingBudget: 1 },
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING }, minItems: "1", maxItems: "3" },
        },
      }),
    extractUsage: (result) => ({
      inputTokens: result.usageMetadata?.promptTokenCount ?? 0,
      // See geminiOutputTokens for why this isn't just candidatesTokenCount (undercounted this
      // feature's real cost by ~3x in a live measurement, even at thinkingBudget: 1 - see the
      // thinkingConfig comment above).
      outputTokens: geminiOutputTokens(result.usageMetadata),
    }),
  });

  // Kept alongside the gateway's own ledger write (not replaced by it) so the existing admin cost
  // dashboard (reads api_cost_log) and win-polish/generate-achievements' own hourly soft-caps
  // (which also query api_cost_log directly) keep working unchanged - see generateResume.ts's
  // identical choice for why both tables coexist during this transition.
  await logApiCost({
    userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model: MODEL_BY_FEATURE[FEATURE].model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: geminiOutputTokens(response.usageMetadata),
  });

  const text = response.text;
  if (!text) {
    throw new AssistBulletError("Unexpected response type from the AI provider");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AssistBulletError("Could not parse the rewritten bullet options");
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((v) => typeof v === "string")) {
    throw new AssistBulletError("Could not parse the rewritten bullet options");
  }

  return parsed.slice(0, 3).map(sanitizeDashes);
}
