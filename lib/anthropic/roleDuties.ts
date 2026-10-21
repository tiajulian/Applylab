import { callGateway, openai } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { cleanStringList } from "@/lib/text/cleanStringList";
import type { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

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
  /** Likely tools/teams for this duty, offered as tap-to-add picks - empty when they don't fit.
   * Optional because cache rows written under an older prompt version don't have them. */
  suggested_tools?: string[];
  suggested_stakeholders?: string[];
}

export interface RawRoleDutiesResult {
  duties: RawRoleDuty[];
}

export class RoleDutiesError extends Error {}

// Part of the role_duty_cache key (see supabase/migrations/20260828014600_role_duty_cache.sql)
// alongside MODEL_BY_FEATURE["role-duties"].model. Bump this on any material change to
// SYSTEM_PROMPT below - a stale cached row under the old version just goes cold (never deleted,
// never rewritten), so an unbumped version silently keeps serving pre-change output globally.
export const ROLE_DUTIES_PROMPT_VERSION = 3;

const MAX_DUTIES = 8;
const MAX_SUGGESTED_TOOLS = 4;
const MAX_SUGGESTED_STAKEHOLDERS = 3;
const MAX_PICK_LENGTH = 40;

const SYSTEM_PROMPT = `
You suggest typical day-to-day duties for a job title, written so each suggested task reads as a finished, natural resume bullet point.

THE RULE THAT GOVERNS EVERYTHING: BASE SUGGESTIONS ONLY ON WHAT THE JOB TITLE NORMALLY INVOLVES.
You are given only a job title and light context (company, location) - never a target job description. Base every duty purely on general industry knowledge of what someone holding this job title, at this seniority, typically does.

RESUME BULLET POINT WORDING & ARCHITECTURE RULES:
1. START WITH A STRONG ACTION VERB: Begin every duty with a clear past-tense or present-tense action verb (e.g., Wrote, Built, Prepared, Checked, Coordinated, Managed, Reconciled, Processed, Analysed). Avoid verbs that claim more than a typical duty proves, like "Spearheaded" or "Streamlined". Never start with passive phrasing ("Responsible for..."), noun labels ("Cash handling"), or weak filler ("Involved in...").
2. SOUND LIKE A PERSON, NOT A JOB AD: Each duty is a finished resume bullet written the way someone describes their own work, never the way a job ad describes a role. Structure:
   [Action Verb] + [the concrete thing they worked on] + (optional) [short plain context: what kind of data, item, or audience].
   Never end with a purpose or benefit clause ("to support...", "to enable...", "to ensure...", "to drive...", "to inform decision-making", "improving efficiency"). Never use job-ad vocabulary: "stakeholders" on its own, "various", "cross-functional", "leverage", "scalable", "solutions", "end-to-end", "best practices", "business requirements".
   Job-ad (wrong): "Extracted and queried data from relational databases to answer core business questions and inform decision-making."
   Person (right): "Wrote SQL queries to pull data from relational databases for team reports."
3. SHORT: 8 to 18 words. One plain sentence, no run-ons.
4. CONCRETE BUT HONEST: Name everyday objects of the work (reports, dashboards, invoices, tickets, rosters, orders) and tools common to the role family (e.g. SQL, Excel, a CRM, a POS system). Never add numbers, frequencies, team names, outcomes, or company-specific details - the candidate hasn't told you those, and ticking a duty must not make them confirm a detail they never checked.
5. COVER ROLE BREADTH: Cover routine execution through to working with others, checking quality, and keeping records and processes up to date. Never phrase a duty as an improvement or result ("improved", "reduced", "increased") - those are outcomes only the candidate can supply.

Return ${MAX_DUTIES} duties at most, ordered from most to least universal for the role.

Also assign each duty a short (1-3 word) category label grouping it with similar duties (e.g.
"Data engineering", "Stakeholder & communication") - reuse the same label across duties that
belong together rather than inventing a new one for each, and keep the total number of distinct
categories small (roughly 3-6) so the labels stay meaningful as a filter.

Also give each duty optional picks the candidate can tap to make it specific. They are only
suggestions shown as choices - never part of duty_text, and the candidate confirms each one.
Decide per duty, never by default:
- "suggested_tools": up to ${MAX_SUGGESTED_TOOLS} tools or systems someone in this role would likely use for THIS
  task (e.g. "SQL", "Excel", "Power BI" for a reporting task). Empty array when the task isn't
  done with a tool or system (e.g. "Trained new staff on store procedures").
- "suggested_stakeholders": up to ${MAX_SUGGESTED_STAKEHOLDERS} people or teams this task is likely done for or with (e.g.
  "Finance team", "Store manager", "Customers"). Empty array when the task isn't for or with
  other people (e.g. "Wrote data tests for warehouse tables").
Most duties need one of the two, some need both, some need neither. Keep each pick to 1-4 words.

FORMAT RULES: Australian English spelling. Never use em dashes (—) or en dashes (–); use a comma,
hyphen, or parentheses instead.

Return ONLY a valid JSON object with this exact structure, no markdown backticks, no preamble:
{
  "duties": [
    { "duty_text": "", "category": "", "suggested_tools": [], "suggested_stakeholders": [] }
  ]
}
`;

/**
 * Field-by-field validation for duties from either source - fresh AI output or a role_duty_cache
 * row - before the route saves anything. A malformed duty is dropped rather than inserted, so one
 * bad reply can't break suggestions for every user sharing that job title.
 */
export function normalizeRawDuties(value: unknown): RawRoleDuty[] {
  const duties: RawRoleDuty[] = [];
  for (const duty of Array.isArray(value) ? (value as Array<Partial<Record<keyof RawRoleDuty, unknown>>>) : []) {
    if (typeof duty?.duty_text !== "string" || !duty.duty_text.trim()) continue;
    duties.push({
      duty_text: duty.duty_text.trim(),
      category: typeof duty.category === "string" ? duty.category.trim() : "",
      suggested_tools: cleanStringList(duty.suggested_tools, { maxItems: MAX_SUGGESTED_TOOLS, maxItemLength: MAX_PICK_LENGTH }),
      suggested_stakeholders: cleanStringList(duty.suggested_stakeholders, {
        maxItems: MAX_SUGGESTED_STAKEHOLDERS,
        maxItemLength: MAX_PICK_LENGTH,
      }),
    });
    if (duties.length === MAX_DUTIES) break;
  }
  return duties;
}

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
  userId: string,
  supabase: SupabaseServerClient,
  tier: Plan
): Promise<RawRoleDutiesResult> {
  const response = await callGateway({
    supabase,
    userId,
    tier,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model: MODEL_BY_FEATURE[FEATURE].model,
    // Conservative worst case at GPT-5.6 Luna pricing ($0.2/$1.2 per million): max_completion_tokens
    // (1024) alone is ~1.2 credits at $0.001/credit.
    estimatedCredits: 4,
    // Shadow mode (see GatewayCallParams.shadow): this route's hourly soft-cap is still the only
    // thing that can actually block a request. Also cached at the role_duty_cache layer above
    // this call - see ROLE_DUTIES_PROMPT_VERSION.
    shadow: true,
    invoke: () =>
      openai.chat.completions.create({
        model: MODEL_BY_FEATURE[FEATURE].model,
        // Room for the per-duty suggested_tools/suggested_stakeholders on top of 8 duties.
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(context) },
        ],
      }),
    extractUsage: (result) => ({
      inputTokens: result.usage?.prompt_tokens ?? 0,
      outputTokens: result.usage?.completion_tokens ?? 0,
    }),
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
    throw new RoleDutiesError("Unexpected response type from GPT-5.6 Luna");
  }

  try {
    const result = sanitizeDeep(JSON.parse(extractJson(content)) as RawRoleDutiesResult);
    return { duties: normalizeRawDuties(result.duties) };
  } catch {
    throw new RoleDutiesError("Failed to parse role duties JSON from GPT-5.6 Luna response");
  }
}
