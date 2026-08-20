import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";

const FEATURE = "role-duties" as const;

export interface RoleDutiesContext {
  jobTitle: string;
  /** Light context only - never the target job description. See SYSTEM_PROMPT below. */
  company?: string;
  location?: string;
}

export interface RawRoleDuty {
  duty_text: string;
  category: string;
}

export interface RawRoleDutiesResult {
  duties: RawRoleDuty[];
}

export class RoleDutiesError extends Error {}

const MAX_DUTIES = 8;

const SYSTEM_PROMPT = `
You suggest the typical day-to-day duties for a job title, so a candidate who wrote little or
nothing for that role in their resume profile can tick the ones they actually did.

THE RULE THAT GOVERNS EVERYTHING: BASE SUGGESTIONS ONLY ON WHAT THE JOB TITLE NORMALLY INVOLVES.
You are given only a job title and light context (company, location) - never a target job the
candidate is applying for. Do not ask for one, do not imagine one, and do not tailor duties toward
any particular application. If you were given a target job description here, suggesting duties
that happen to match it would nudge the candidate to falsely claim convenient things they never
did - that is exactly what this feature exists to prevent. Base every duty purely on general
industry knowledge of what someone holding this job title, at this seniority, typically does.

FOR EACH DUTY:
- Write it as a plain, concrete statement of a task, the way a real person would recognise it
  about their own work (e.g. "Reconciled till takings at the end of a shift", not "Cash handling").
- Keep it generic to the role, never inventing a specific company, system, or number - the
  candidate supplies specifics themselves by confirming and (optionally) annotating it.
- Cover the range of what the role normally spans (routine tasks through to less obvious ones),
  not just the most obvious one or two.

Return ${MAX_DUTIES} duties at most, ordered from most to least universal for the role.

Also assign each duty a short (1-3 word) category label grouping it with similar duties (e.g.
"Data engineering", "Stakeholder & communication") - reuse the same label across duties that
belong together rather than inventing a new one for each, and keep the total number of distinct
categories small (roughly 3-6) so the labels stay meaningful as a filter.

FORMAT RULES: Australian English spelling. Never use em dashes (—) or en dashes (–); use a comma,
hyphen, or parentheses instead.

Return ONLY a valid JSON object with this exact structure, no markdown backticks, no preamble:
{
  "duties": [
    { "duty_text": "", "category": "" }
  ]
}
`;

function buildUserMessage(context: RoleDutiesContext): string {
  return `
JOB TITLE: ${context.jobTitle}
${context.company ? `Company (for industry flavour only, do not reference it in duty text): ${context.company}` : ""}
${context.location ? `Location: ${context.location}` : ""}

List the typical duties for this job title based on general knowledge of the role. Do not ask
about or assume any target job the candidate might be applying for - none was given, and none is
relevant.
`.trim();
}

export async function suggestRoleDuties(
  context: RoleDutiesContext,
  userId: string
): Promise<RawRoleDutiesResult> {
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(context) }],
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
    throw new RoleDutiesError("Unexpected response type from Claude");
  }

  try {
    const result = sanitizeDeep(JSON.parse(extractJson(block.text)) as RawRoleDutiesResult);
    return { duties: (result.duties ?? []).slice(0, MAX_DUTIES) };
  } catch {
    throw new RoleDutiesError("Failed to parse role duties JSON from Claude response");
  }
}
