import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { ResumeContent } from "@/types";

const FEATURE = "duplicate-retailor" as const;

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
- Rework the professional summary to speak to the new role, staying within 3-4 lines (about
  60-85 words). No filler adjectives.
- Update "target_titles" (2-3 short title variants under the name) to genuinely match the new
  target role and the candidate's real seniority/specialty - never a materially different
  seniority level. Return [] if nothing fits well.
- Re-order and re-emphasise "skills" (Key Skills, flat competency terms) and bullet phrasing to
  mirror the new job description's keywords, for ATS keyword matching, but do not lengthen
  bullets or add new ones - the resume should still fit within a page or two, so keep bullet
  counts and lengths comparable to the original. Every bullet must still contain a number or a
  named system - if re-emphasis would strip that out, keep the original bullet instead.
- "tools" (Tools & Platforms, labelled category rows "Category label: item, item, item", about
  4-6 categories) must stay in that labelled format - re-emphasise which items lead within each
  category, don't flatten it back into an unlabelled list, don't mix skills into it.
- "projects" entries are fixed facts (same as employers/dates below) - preserve them as given,
  only re-emphasise bullet phrasing the same way experience bullets are re-emphasised, never add
  a new project or invent one.
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
  "target_titles": [],
  "summary": "",
  "skills": [],
  "tools": [],
  "experience": [
    { "job_title": "", "company": "", "company_description": "", "location": "", "start_date": "", "end_date": "", "bullets": [] }
  ],
  "projects": [
    { "title": "", "context": "", "year": "", "bullets": [] }
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
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 4096,
    system: RETAILOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(existing, target) }],
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
    throw new RetailorResumeError("Unexpected response type from Claude");
  }

  try {
    return sanitizeDeep(JSON.parse(extractJson(block.text)) as ResumeContent);
  } catch {
    throw new RetailorResumeError("Failed to parse retailored resume JSON from Claude response");
  }
}
