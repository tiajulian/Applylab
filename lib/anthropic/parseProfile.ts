import { callGateway, openai } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { createClient } from "@/lib/supabase/server";
import type {
  EducationEntry,
  ParsedProfileFields,
  Plan,
  ProjectEntry,
  RefereeEntry,
  WorkExperienceEntry,
  WorkExperienceWin,
} from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

const FEATURE = "profile-parse" as const;

/**
 * Gateway metering is optional here (every other ported feature makes it mandatory) because this
 * function has a genuine no-account caller: app/api/public/score-resume/route.ts's anonymous
 * lead-magnet flow, which sometimes has no real user_id at all (a literal "anonymous-lead-magnet"
 * string, not a UUID - see that route's userIdForCost). callGateway's reserve/commit RPCs require
 * a real authenticated session and a real user_id row (FK to public.users), which that flow
 * cannot provide - passing null there is correct, not a shortcut, until spec §11's IP/device-
 * fingerprint design gives the anonymous scorer its own real abuse control. The other caller
 * (app/api/profile/parse/route.ts) is a real logged-in user and always passes one.
 */
export interface ParseProfileGatewayContext {
  supabase: SupabaseServerClient;
  tier: Plan;
}

const PROFILE_EXTRACTION_SYSTEM_PROMPT = `
You extract structured candidate profile data from a resume or a pasted LinkedIn profile.
If a field is not present in the source text, use an empty string or an empty array.
Never invent employers, dates, qualifications, or referees. Preserve the candidate's
original wording for the "description" field of each work experience entry.
For "wins", only add an entry if the source text clearly calls out one specific thing the candidate
built, improved, fixed, or delivered in that role (a standout line, not a restatement of the whole
description) - each distinct one becomes its own entry. Leave "wins" as an empty array if nothing
that specific is stated - never invent one or infer a number that isn't in the source text. For a
win's "metric", only fill it in if the source text states a real number or metric attached to that
exact win (e.g. "30%", "$50k", "3 new hires") - leave it as an empty string otherwise, never
estimate or round one. Same rule for "outcome_metric" against "outcome" below.

For "projects", only extract an entry if the source text clearly describes something standalone,
not tied to one of the listed roles above (a side project, freelance work, volunteer work, or a
study/academic project - often under a heading like "Projects", "Portfolio", or similar). Never
turn a listed job's own duties into a project, and never invent a project. Leave "projects" as an
empty array if nothing like this is stated.
`;

export class ProfileParseError extends Error {}

const WIN_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    metric: { type: "string" },
  },
  required: ["text", "metric"],
  additionalProperties: false,
};

const WORK_EXPERIENCE_SCHEMA = {
  type: "object",
  properties: {
    job_title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    start_date: { type: "string" },
    end_date: { type: "string" },
    description: { type: "string" },
    wins: { type: "array", items: WIN_SCHEMA },
  },
  required: ["job_title", "company", "location", "start_date", "end_date", "description", "wins"],
  additionalProperties: false,
};

const PROJECT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    context: { type: "string" },
    timeframe: { type: "string" },
    tools: { type: "array", items: { type: "string" } },
    link: { type: "string" },
    outcome: { type: "string" },
    outcome_metric: { type: "string" },
  },
  required: ["title", "description", "context", "timeframe", "tools", "link", "outcome", "outcome_metric"],
  additionalProperties: false,
};

const EDUCATION_SCHEMA = {
  type: "object",
  properties: {
    degree: { type: "string" },
    institution: { type: "string" },
    start_date: { type: "string" },
    end_date: { type: "string" },
    notes: { type: "string" },
  },
  required: ["degree", "institution", "start_date", "end_date", "notes"],
  additionalProperties: false,
};

const REFEREE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    title: { type: "string" },
    organisation: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
  },
  required: ["name", "title", "organisation", "phone", "email"],
  additionalProperties: false,
};

const PROFILE_JSON_SCHEMA = {
  type: "object",
  properties: {
    fullName: { type: "string" },
    phone: { type: "string" },
    location: { type: "string" },
    linkedin_url: { type: "string" },
    work_rights: { type: "string" },
    skills: { type: "array", items: { type: "string" } },
    work_experience: { type: "array", items: WORK_EXPERIENCE_SCHEMA },
    projects: { type: "array", items: PROJECT_SCHEMA },
    education: { type: "array", items: EDUCATION_SCHEMA },
    referees: { type: "array", items: REFEREE_SCHEMA },
  },
  required: [
    "fullName",
    "phone",
    "location",
    "linkedin_url",
    "work_rights",
    "skills",
    "work_experience",
    "projects",
    "education",
    "referees",
  ],
  additionalProperties: false,
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeWins(value: unknown): WorkExperienceWin[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((win): win is Record<string, unknown> => typeof win === "object" && win !== null)
    .map((win) => ({
      text: str(win.text),
      metric: str(win.metric),
    }))
    .filter((win) => win.text.trim().length > 0);
}

function sanitizeExperience(value: unknown): WorkExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      job_title: str(entry.job_title),
      company: str(entry.company),
      location: str(entry.location),
      start_date: str(entry.start_date),
      end_date: str(entry.end_date),
      // AI extraction never sets this - normalizeWorkExperience.ts migrates it from a
      // "Present"-style end_date the first time the profile form reads this entry.
      is_current: false,
      description: str(entry.description),
      wins: sanitizeWins(entry.wins),
    }));
}

function sanitizeProjects(value: unknown): ProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      title: str(entry.title),
      description: str(entry.description),
      context: str(entry.context),
      timeframe: str(entry.timeframe),
      tools: sanitizeSkills(entry.tools),
      link: str(entry.link),
      outcome: str(entry.outcome),
      outcome_metric: str(entry.outcome_metric),
    }))
    .filter((entry) => entry.title.trim().length > 0);
}

function sanitizeEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      degree: str(entry.degree),
      institution: str(entry.institution),
      start_date: str(entry.start_date),
      end_date: str(entry.end_date),
      // AI extraction never sets this - normalizeEducation.ts migrates it from a legacy `year`
      // string the first time the profile form reads this entry.
      is_current: false,
      notes: str(entry.notes),
    }));
}

function sanitizeReferees(value: unknown): RefereeEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      name: str(entry.name),
      title: str(entry.title),
      organisation: str(entry.organisation),
      phone: str(entry.phone),
      email: str(entry.email),
    }));
}

function sanitizeSkills(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function isEmptyProfile(profile: ParsedProfileFields): boolean {
  return (
    !profile.fullName &&
    profile.work_experience.length === 0 &&
    profile.education.length === 0 &&
    profile.skills.length === 0
  );
}

export async function parseProfileFromText(
  sourceText: string,
  userId: string,
  gatewayContext?: ParseProfileGatewayContext | null
): Promise<ParsedProfileFields> {
  if (!sourceText || !sourceText.trim()) {
    throw new ProfileParseError("No text to parse");
  }

  const invoke = () =>
    openai.chat.completions.create({
      model: MODEL_BY_FEATURE[FEATURE].model,
      temperature: 0,
      max_tokens: 4096,
      response_format: {
        type: "json_schema",
        json_schema: { name: "parsed_profile", strict: true, schema: PROFILE_JSON_SCHEMA },
      },
      messages: [
        { role: "system", content: PROFILE_EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `Source text:\n${sourceText}` },
      ],
    });

  const response = gatewayContext
    ? await callGateway({
        supabase: gatewayContext.supabase,
        userId,
        tier: gatewayContext.tier,
        feature: FEATURE,
        provider: MODEL_BY_FEATURE[FEATURE].provider,
        model: MODEL_BY_FEATURE[FEATURE].model,
        // Conservative worst case at GPT-5.6 Luna pricing ($0.2/$1.2 per million): max_tokens
        // (4096) alone is ~5 credits at $0.001/credit, plus headroom for a long resume/LinkedIn
        // paste in the prompt. Real cost replaces the estimate at commit time regardless.
        estimatedCredits: 10,
        // Shadow mode (see GatewayCallParams.shadow): the route's own rate limits are still the
        // only thing that can actually block a request.
        shadow: true,
        invoke,
        extractUsage: (result) => ({
          inputTokens: result.usage?.prompt_tokens ?? 0,
          outputTokens: result.usage?.completion_tokens ?? 0,
        }),
      })
    : await invoke();

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
    throw new ProfileParseError("Unexpected response type from the AI provider");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ProfileParseError("Could not parse the extracted profile. Please try again or start from scratch.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ProfileParseError("Could not parse the extracted profile. Please try again or start from scratch.");
  }

  const record = parsed as Record<string, unknown>;
  const profile: ParsedProfileFields = {
    fullName: str(record.fullName),
    phone: str(record.phone),
    location: str(record.location),
    linkedin_url: str(record.linkedin_url),
    work_rights: str(record.work_rights),
    skills: sanitizeSkills(record.skills),
    work_experience: sanitizeExperience(record.work_experience),
    projects: sanitizeProjects(record.projects),
    education: sanitizeEducation(record.education),
    referees: sanitizeReferees(record.referees),
  };

  if (isEmptyProfile(profile)) {
    throw new ProfileParseError("We couldn't find enough detail in that document. Try Start from scratch instead.");
  }

  return sanitizeDeep(profile);
}
