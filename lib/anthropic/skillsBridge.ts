// Calls OpenAI (GPT-5.6 Luna), not Claude - kept in lib/anthropic/ (like lib/anthropic/parseJobAd.ts
// and generateResume.ts before it) so this file's path doesn't churn every caller's import on a
// provider move. See lib/anthropic/models.ts's MODEL_BY_FEATURE["skills-bridge"] comment for the
// comparison that justified this - Luna held the line on the exact fabrication-adjacent judgement
// call (a real skill gap vs. a plausible-but-unstated one) that Gemini and GPT-5.6 Terra got wrong.
import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { BridgeConfidence, BridgeItemState, BridgeMode, UserProfile } from "@/types";

const FEATURE = "skills-bridge" as const;

export interface SkillsBridgeTarget {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

export interface RawBridgeItem {
  source_company: string;
  source_job_title: string;
  source_snippet: string;
  competency: string;
  target_requirement: string;
  state: BridgeItemState;
  confidence: BridgeConfidence;
}

export interface RawBridgeResult {
  mode: BridgeMode;
  items: RawBridgeItem[];
}

export class SkillsBridgeError extends Error {}

const SYSTEM_PROMPT = `
You are an expert career counsellor who helps candidates see how their real, lived experience
connects to a target role, especially when the connection isn't obvious. You are given a
candidate's full work history and a target job, and must produce a "skills bridge": a mapping
from what they actually did to what the target role wants.

THE RULE THAT GOVERNS EVERYTHING: NEVER FABRICATE EXPERIENCE.
You may re-word and elevate real, evidenced experience into the target role's language. You must
never claim a skill, system, responsibility, or achievement the candidate's own profile does not
support. When in doubt, use "to_confirm" or "gap" instead of "matched" - it is always better to
ask the candidate than to assume.

FIRST, DETERMINE THE MODE:
- "pivot": the target role is a different field/industry from the candidate's background. Your
  job is to TRANSLATE vocabulary - find the real underlying competency and re-title it in the
  target field's language, without swapping in skills they don't have.
- "level_up": the target role is the same field, a step up in scope, seniority, or ownership.
  Your job is to ELEVATE scope and impact language for real work already done, not to introduce
  new vocabulary from a different field.

THEN, FOR EACH NOTABLE REQUIREMENT OR THEME IN THE TARGET ROLE, PRODUCE ONE ITEM IN ONE OF THREE STATES:
- "matched": there is direct, explicit evidence in the candidate's work history (their own
  description text) for this competency. source_company and source_job_title MUST be copied
  EXACTLY as given in the candidate's work history (character-for-character company and job
  title strings) - this is used to programmatically verify the item against a real job, so any
  mismatch means the item is discarded. source_snippet is a short quote or close paraphrase of
  the part of that job's description that supports it.
- "to_confirm": a plausible but UNSTATED inference - the kind of thing someone in that real job
  almost certainly did, but the candidate's text doesn't explicitly say so. source_company and
  source_job_title still MUST exactly match a real job (this is a guess ABOUT that specific real
  job, not an invented one). Phrase competency as a plain, concrete yes/no question a real person
  would recognise about their own work (e.g. "Did you reconcile takings at the end of a shift?").
- "gap": the target role wants this and there is no evidence anywhere in the candidate's history,
  stated or plausible. source_company and source_job_title MUST be empty strings "" - never
  attach a gap to a job that isn't evidence for it. competency briefly names the missing skill.

FOR EVERY ITEM:
- target_requirement: the specific thing from the target job description this addresses, in the
  target role's own language.
- competency: for matched/to_confirm, the transferable competency in plain language grounded in
  what the candidate actually did. For gap, the missing skill/theme itself.
- confidence: "high" if the evidence is explicit and strong, "medium" if it's a reasonable but
  less direct inference, "low" for a stretch worth flagging as such. gap items are typically
  "high" confidence that it IS a gap.

FORMAT RULES: Australian English spelling. Never use em dashes (—) or en dashes (–);
use a comma, hyphen, or parentheses instead.

Return the skills bridge matching the required JSON schema.
`;

const BRIDGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["pivot", "level_up"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source_company: { type: "string" },
          source_job_title: { type: "string" },
          source_snippet: { type: "string" },
          competency: { type: "string" },
          target_requirement: { type: "string" },
          state: { type: "string", enum: ["matched", "to_confirm", "gap"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: [
          "source_company",
          "source_job_title",
          "source_snippet",
          "competency",
          "target_requirement",
          "state",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["mode", "items"],
  additionalProperties: false,
};

function buildUserMessage(profile: UserProfile, target: SkillsBridgeTarget): string {
  return `
TARGET ROLE:
Job title: ${target.jobTitle}
Company: ${target.companyName}
Job description:
${target.jobDescription}

CANDIDATE'S REAL WORK HISTORY (source_company/source_job_title for matched/to_confirm items must
exactly copy the company/job_title strings below):
${JSON.stringify(profile.work_experience ?? [], null, 2)}

Candidate's listed skills: ${(profile.skills ?? []).join(", ")}

Candidate's education:
${JSON.stringify(profile.education ?? [], null, 2)}

${profile.raw_linkedin_paste ? `Additional context pasted from LinkedIn:\n${profile.raw_linkedin_paste}` : ""}

Produce the skills bridge for this candidate toward this target role. Cover the target role's
main requirements/themes with one item each. Never invent a job, employer, or skill not present
above.
`.trim();
}

export async function analyzeSkillsBridge(
  profile: UserProfile,
  target: SkillsBridgeTarget,
  userId: string
): Promise<RawBridgeResult> {
  const response = await openai.chat.completions.create({
    model: MODEL_BY_FEATURE[FEATURE].model,
    max_completion_tokens: 4096,
    response_format: {
      type: "json_schema",
      json_schema: { name: "skills_bridge", strict: true, schema: BRIDGE_JSON_SCHEMA },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(profile, target) },
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
  if (!content) {
    throw new SkillsBridgeError("Unexpected response type from GPT-5.6 Luna");
  }

  try {
    return sanitizeDeep(JSON.parse(content) as RawBridgeResult);
  } catch {
    throw new SkillsBridgeError("Failed to parse skills bridge JSON from GPT-5.6 Luna response");
  }
}
