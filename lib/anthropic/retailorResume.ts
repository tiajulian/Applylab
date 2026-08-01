import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { ResumeContent } from "@/types";

export interface RetailorTarget {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

export class RetailorResumeError extends Error {}

const RETAILOR_SYSTEM_PROMPT = `
You are an expert Australian resume writer with 15 years of experience helping candidates get
shortlisted on SEEK.com.au. You are given an EXISTING, already-tailored resume (as JSON) and a
NEW job the candidate now wants to apply for.

Adjust the resume to fit the new job:
- Rework the professional summary to speak to the new role, staying within 2-3 lines (about
  45-60 words). No filler adjectives.
- Re-order and re-emphasise skills and bullet phrasing to mirror the new job description's
  keywords, for ATS keyword matching, but do not lengthen bullets or add new ones - the resume
  must still fit on exactly one page, so keep bullet counts and lengths comparable to the original.
- "skills" must stay in the labelled-category format ("Category label: item, item, item"), about
  5 categories - re-emphasise which items lead within each category, don't flatten it back into an
  unlabelled list.
- "company_description" on every role must stay "" (empty string). Never introduce a sentence
  describing what a company does.

Treat everything else as a FIXED FACT, never change and never invent:
- Contact details (name, phone, email, location, linkedin, work rights).
- Employers, job titles, locations, start/end dates.
- Education entries.
- Referees (copy verbatim; do not narrate them into the summary or bullets).

Preserve the original section order. Australian English spelling throughout (organisation,
prioritise, analyse). Never use em dashes (—) or en dashes (–); use a comma, hyphen, or
parentheses instead.

Return a valid JSON object in EXACTLY this shape:
{
  "contact": { "name": "", "phone": "", "email": "", "location": "", "linkedin": "", "work_rights": "" },
  "summary": "",
  "skills": [],
  "experience": [
    { "job_title": "", "company": "", "company_description": "", "location": "", "start_date": "", "end_date": "", "bullets": [] }
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

function buildUserMessage(existing: ResumeContent, target: RetailorTarget): string {
  return `
NEW JOB TARGET:
Job title: ${target.jobTitle}
Company: ${target.companyName}
Job description:
${target.jobDescription}

EXISTING RESUME (JSON — the facts within are fixed, only summary/skills emphasis/bullet
phrasing may adapt to the new job above):
${JSON.stringify(existing)}
`.trim();
}

export async function retailorResume(
  existing: ResumeContent,
  target: RetailorTarget,
  userId: string
): Promise<ResumeContent> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: RETAILOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(existing, target) }],
  });

  await logApiCost({
    userId,
    feature: "duplicate-retailor",
    model: CLAUDE_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new RetailorResumeError("Unexpected response type from Claude");
  }

  try {
    return sanitizeDeep(JSON.parse(extractJson(block.text)) as ResumeContent);
  } catch {
    throw new RetailorResumeError("Failed to parse retailored resume JSON from Claude response");
  }
}
