import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import type { GenerateResumeInput, ResumeContent } from "@/types";

const RESUME_SYSTEM_PROMPT = `
You are an expert Australian resume writer with 15 years of experience helping candidates get shortlisted on SEEK.com.au. You understand the Australian job market deeply including SEEK ATS requirements, PageUp, Workday, and JobAdder parsing rules.

STRICT AUSTRALIAN FORMAT RULES YOU MUST ALWAYS FOLLOW:
- A4 format
- Australian English only (organisation NOT organization, prioritise NOT prioritize, analyse NOT analyze)
- 2-3 pages for experienced candidates
- Single column layout
- NO photos
- Include work rights status
- Referees section with full contact details (never "available on request")
- Quantify all achievements with metrics
- Section order: Contact Details → Work Rights → Professional Summary → Key Skills → Work Experience → Education → Referees

OUTPUT FORMAT:
Return a valid JSON object with this exact structure:
{
  "contact": {
    "name": "",
    "phone": "",
    "email": "",
    "location": "Suburb, State",
    "linkedin": "",
    "work_rights": ""
  },
  "summary": "",
  "skills": [],
  "experience": [
    {
      "job_title": "",
      "company": "",
      "company_description": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "year": "",
      "notes": ""
    }
  ],
  "referees": [
    {
      "name": "",
      "title": "",
      "organisation": "",
      "phone": "",
      "email": ""
    }
  ]
}

Return ONLY the JSON. No preamble, no explanation, no markdown backticks.
`;

function buildUserMessage(input: GenerateResumeInput): string {
  const { jobDescription, jobTitle, companyName, profile, fullName, email } = input;

  return `
JOB TARGET:
Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

CANDIDATE DETAILS:
Full name: ${fullName}
Email: ${email}
Phone: ${profile.phone ?? ""}
Location: ${profile.location ?? ""}
LinkedIn: ${profile.linkedin_url ?? ""}
Work rights: ${profile.work_rights ?? ""}

Key skills (candidate-provided, expand/prioritise against the job description):
${profile.skills?.join(", ") ?? ""}

Work experience (raw notes — rewrite into polished, quantified bullet points):
${JSON.stringify(profile.work_experience ?? [], null, 2)}

Education:
${JSON.stringify(profile.education ?? [], null, 2)}

Referees (use exactly as provided, do not invent):
${JSON.stringify(profile.referees ?? [], null, 2)}

${profile.raw_linkedin_paste ? `Additional context pasted from LinkedIn:\n${profile.raw_linkedin_paste}` : ""}

Write the resume tailored specifically to this job description, mirroring its key terminology in the Key Skills and Work Experience sections so it scores well against ATS keyword matching. Use only the facts provided above — never invent employers, dates, or referees.
`.trim();
}

export async function generateResume(input: GenerateResumeInput, userId: string): Promise<ResumeContent> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: RESUME_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  await logApiCost({
    userId,
    feature: "generate-resume",
    model: CLAUDE_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const json = extractJson(block.text);

  try {
    return JSON.parse(json) as ResumeContent;
  } catch {
    throw new Error("Failed to parse resume JSON from Claude response");
  }
}
