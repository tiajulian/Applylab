import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import type { EducationEntry, ParsedProfileFields, ProjectEntry, RefereeEntry, WorkExperienceEntry } from "@/types";

const FEATURE = "profile-parse" as const;

const PROFILE_EXTRACTION_SYSTEM_PROMPT = `
You extract structured candidate profile data from a resume or a pasted LinkedIn profile.
Return ONLY valid JSON matching the schema below: no prose, no markdown, no code fences.
If a field is not present in the source text, use an empty string or an empty array.
Never invent employers, dates, qualifications, or referees. Preserve the candidate's
original wording for the "description" field of each work experience entry.
For "achievement", only fill it in if the source text clearly calls out one specific thing the
candidate built, improved, fixed, or delivered in that role (a standout line, not a restatement of
the whole description). Leave it as an empty string if nothing that specific is stated - never
invent one or infer a number that isn't in the source text.

For "projects", only extract an entry if the source text clearly describes something standalone,
not tied to one of the listed roles above (a side project, freelance work, volunteer work, or a
study/academic project - often under a heading like "Projects", "Portfolio", or similar). Never
turn a listed job's own duties into a project, and never invent a project. Leave "projects" as an
empty array if nothing like this is stated.

Schema:
{
  "fullName": "",
  "phone": "",
  "location": "Suburb, State",
  "linkedin_url": "",
  "work_rights": "",
  "skills": [],
  "work_experience": [
    { "job_title": "", "company": "", "location": "", "start_date": "", "end_date": "", "description": "", "achievement": "" }
  ],
  "projects": [
    { "title": "", "description": "", "context": "", "timeframe": "", "tools": [], "link": "", "outcome": "" }
  ],
  "education": [
    { "degree": "", "institution": "", "year": "", "notes": "" }
  ],
  "referees": [
    { "name": "", "title": "", "organisation": "", "phone": "", "email": "" }
  ]
}

Return ONLY the JSON. No preamble, no explanation, no markdown backticks.
`;

export class ProfileParseError extends Error {}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
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
      description: str(entry.description),
      achievement: str(entry.achievement),
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
      year: str(entry.year),
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

export async function parseProfileFromText(sourceText: string, userId: string): Promise<ParsedProfileFields> {
  if (!sourceText || !sourceText.trim()) {
    throw new ProfileParseError("No text to parse");
  }

  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 4096,
    system: PROFILE_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Source text:\n${sourceText}` }],
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
    throw new ProfileParseError("Unexpected response type from Claude");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(block.text));
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

  return profile;
}
