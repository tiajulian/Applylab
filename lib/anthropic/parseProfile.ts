import { anthropic, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json";
import type { EducationEntry, ParsedProfileFields, RefereeEntry, WorkExperienceEntry } from "@/types";

const PROFILE_EXTRACTION_SYSTEM_PROMPT = `
You extract structured candidate profile data from a resume or a pasted LinkedIn profile.
Return ONLY valid JSON matching the schema below — no prose, no markdown, no code fences.
If a field is not present in the source text, use an empty string or an empty array.
Never invent employers, dates, qualifications, or referees. Preserve the candidate's
original wording for the "description" field of each work experience entry.

Schema:
{
  "fullName": "",
  "phone": "",
  "location": "Suburb, State",
  "linkedin_url": "",
  "work_rights": "",
  "skills": [],
  "work_experience": [
    { "job_title": "", "company": "", "location": "", "start_date": "", "end_date": "", "description": "" }
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
    }));
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

export async function parseProfileFromText(sourceText: string): Promise<ParsedProfileFields> {
  if (!sourceText || !sourceText.trim()) {
    throw new ProfileParseError("No text to parse");
  }

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL_FAST,
    max_tokens: 4096,
    system: PROFILE_EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Source text:\n${sourceText}` }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new ProfileParseError("Unexpected response type from Claude");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(block.text));
  } catch {
    throw new ProfileParseError("Could not parse the extracted profile — please try again or start from scratch");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ProfileParseError("Could not parse the extracted profile — please try again or start from scratch");
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
    education: sanitizeEducation(record.education),
    referees: sanitizeReferees(record.referees),
  };

  if (isEmptyProfile(profile)) {
    throw new ProfileParseError("We couldn't find enough detail in that document — try Start from scratch instead");
  }

  return profile;
}
