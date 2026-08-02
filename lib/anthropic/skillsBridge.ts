import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { BridgeConfidence, BridgeItemState, BridgeMode, UserProfile } from "@/types";

// STAYS ON SONNET - do not move this to Haiku. This is a reasoning-heavy differentiator: mapping
// a candidate's real, lived experience onto a target role's requirements (especially pivot/gap
// judgement calls) needs stronger reasoning than Haiku gives, and a shallower mapping here directly
// weakens the never-fabricate guarantee this feature exists to support. See lib/anthropic/models.ts.
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

Return ONLY a valid JSON object with this exact structure, no markdown backticks, no preamble:
{
  "mode": "pivot",
  "items": [
    {
      "source_company": "",
      "source_job_title": "",
      "source_snippet": "",
      "competency": "",
      "target_requirement": "",
      "state": "matched",
      "confidence": "medium"
    }
  ]
}
`;

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
  // Note: this system prompt is ~940 tokens, under Sonnet's 1024-token minimum cacheable prefix,
  // so this breakpoint currently writes/reads nothing (cache_creation/read stay 0). Left in place
  // so caching activates automatically if the prompt grows past the threshold later.
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(profile, target) }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    model: MODEL_BY_FEATURE[FEATURE],
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new SkillsBridgeError("Unexpected response type from Claude");
  }

  try {
    return sanitizeDeep(JSON.parse(extractJson(block.text)) as RawBridgeResult);
  } catch {
    throw new SkillsBridgeError("Failed to parse skills bridge JSON from Claude response");
  }
}
