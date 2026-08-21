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
  /** Duty texts already suggested for this job title (any state - pending, confirmed, or
   * rejected) - passed when the candidate asks for more after using up an earlier batch (see
   * "Get more suggestions" in SuggestTasksBuilder.tsx), so the new batch doesn't just repeat the
   * same ones back. */
  excludeDuties?: string[];
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
You suggest typical day-to-day duties for a job title, written specifically so each suggested task reads as a high-impact, professional resume bullet point.

THE RULE THAT GOVERNS EVERYTHING: BASE SUGGESTIONS ONLY ON WHAT THE JOB TITLE NORMALLY INVOLVES.
You are given only a job title and light context (company, location) - never a target job description. Base every duty purely on general industry knowledge of what someone holding this job title, at this seniority, typically does.

RESUME BULLET POINT WORDING & ARCHITECTURE RULES:
1. START WITH A STRONG ACTION VERB: Begin every duty with a powerful past-tense or present-tense action verb (e.g., Extracted, Engineered, Developed, Automated, Spearheaded, Coordinated, Managed, Reconciled, Processed, Streamlined, Analyzed). Never start with passive phrasing ("Responsible for..."), noun labels ("Cash handling"), or weak filler ("Involved in...").
2. IMPACT & CONTEXT STRUCTURE: Format every task using proven resume bullet architecture:
   [Strong Action Verb] + [Core Task / Tool / Technical Area] + [Operational Outcome / Business Context / Purpose].
   Example: "Extracted and queried data from relational databases to answer core business questions and inform decision-making."
3. CRISP & PROFESSIONAL LENGTH: Write concise, highly polished 12 to 25 word bullet points. Avoid informal phrasing, conversational fluff, or run-on sentences.
4. GENERIC YET CONCRETE: Reference tools, standards, or methodologies common to the role family (e.g., SQL, Excel, CRM, Agile, Python, safety procedures) without inventing specific unverified metrics or private company names.
5. COVER ROLE BREADTH: Cover routine execution through to stakeholder collaboration, quality assurance, and workflow optimization.

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
${
  context.excludeDuties && context.excludeDuties.length > 0
    ? `\nALREADY SUGGESTED (do not repeat these or close paraphrases of them - find different, still-genuine duties instead):\n${context.excludeDuties.map((d) => `- ${d}`).join("\n")}`
    : ""
}

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
