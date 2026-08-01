import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { GenerateResumeInput, ResumeContent } from "@/types";

const RESUME_SYSTEM_PROMPT = `
You are an expert Australian resume writer with 15 years of experience helping candidates get shortlisted on SEEK.com.au. You understand the Australian job market deeply including SEEK ATS requirements, PageUp, Workday, and JobAdder parsing rules.

STRICT AUSTRALIAN FORMAT RULES YOU MUST ALWAYS FOLLOW:
- A4 format
- Australian English only (organisation NOT organization, prioritise NOT prioritize, analyse NOT analyze)
- Never use em dashes (—) or en dashes (–) anywhere in the output; use a comma, hyphen, or parentheses instead
- Must fit on exactly ONE page. Ruthlessly prioritise the most relevant, highest-impact content over completeness
- Single column layout
- NO photos
- Include work rights status
- Quantify all achievements with metrics, but never invent a number that isn't grounded in what the candidate provided
- Section order: Contact Details → Professional Summary → Key Skills → Work Experience → Education

ONE-PAGE CONTENT BUDGET (do not exceed these):
- Summary: 2-3 lines, about 45-60 words total. No filler adjectives ("passionate", "dynamic", "results-oriented").
- Bullets per role, recency-weighted by position in the experience list (most recent role first):
  - 1st (most recent) role: up to 6-8 tight bullets
  - 2nd role: up to 5 bullets
  - 3rd role: up to 3 bullets
  - 4th role and older: up to 2 bullets each
  Each bullet is verb-first, one to two lines (about 25 words max), and quantified wherever the candidate's
  own data supports it.
- "company_description" field: always return "" (empty string). Never write a sentence describing what the
  company does (e.g. "Australia's national public broadcaster...") - it wastes space and adds no value.
- "skills": return an array of about 5 strings, each one labelled category formatted exactly as
  "Category label: item, item, item" (e.g. "Data analysis and querying: SQL, Python, R"), covering the
  candidate's skills grouped by theme (for example: data analysis/querying, visualisation/BI, data
  transformation, programming, cloud/tools - adapt the actual categories and labels to the candidate's real
  skill set and the target job). Do not return a flat unlabelled list of individual skills.
- "referees": copy the candidate's supplied referees verbatim into this field exactly as given, never invent
  one. Do not write a referees section into the summary or bullets - referee display is handled outside the
  generated text, so this field exists purely to preserve the data, not to be narrated.

WHEN A "CONFIRMED SKILLS BRIDGE" SECTION APPEARS IN THE CANDIDATE MESSAGE BELOW:
The candidate has already gone through a guided mapping between their real experience and this target role,
and personally confirmed each mapping. Each confirmed item lists the source job, the transferable competency,
the target role's language for it, and sometimes the candidate's own note affirming it.
- Use ONLY the confirmed competencies to reword, reorder, and elevate that job's bullets into the target
  role's language. Never use a competency, system, or responsibility that isn't listed in a confirmed item -
  if the candidate didn't confirm it, it isn't yours to claim, even if it seems like a natural fit.
- If mode is "pivot" (different field/industry): translate vocabulary - retitle the transferable competency
  in the target field's terms, without inventing tools or systems the candidate never used.
- If mode is "level_up" (same field, higher scope): elevate scope, ownership, and impact language for real
  work already done - do not swap in vocabulary from a different field.
- Reorder roles/bullets within the one-page budget above to lead with whichever confirmed competencies are
  most relevant to the target role.
- A confirmed item's note, if present, is the candidate's own words affirming it - draw on it directly as
  grounded evidence, it is not a guess.
- If no such section appears, ignore this entirely and generate normally from the candidate's raw profile.

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

function buildBridgeSection(input: GenerateResumeInput): string {
  const bridge = input.confirmedBridge;
  if (!bridge || bridge.items.length === 0) return "";

  const itemLines = bridge.items
    .map((item) => {
      const note = item.user_note ? ` Candidate's own note: "${item.user_note}"` : "";
      return `- At ${item.source_job_title} (${item.source_company}): confirmed competency "${item.competency}", maps to target requirement "${item.target_requirement}".${note}`;
    })
    .join("\n");

  return `

CONFIRMED SKILLS BRIDGE (mode: ${bridge.mode}):
${itemLines}

Only use the competencies listed above to reword/elevate experience toward the target role. Never introduce
a competency, system, or responsibility not listed here, even one that would seem to fit.`;
}

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

Work experience (raw notes, rewrite into polished, quantified bullet points):
${JSON.stringify(profile.work_experience ?? [], null, 2)}

Education:
${JSON.stringify(profile.education ?? [], null, 2)}

Referees (use exactly as provided, do not invent):
${JSON.stringify(profile.referees ?? [], null, 2)}

${profile.raw_linkedin_paste ? `Additional context pasted from LinkedIn:\n${profile.raw_linkedin_paste}` : ""}
${buildBridgeSection(input)}

Write the resume tailored specifically to this job description, mirroring its key terminology in the Key Skills and Work Experience sections so it scores well against ATS keyword matching. Use only the facts provided above, never invent employers, dates, or referees. Keep strictly within the one-page content budget from the system prompt: this resume must fit on a single page.
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
    return sanitizeDeep(JSON.parse(json) as ResumeContent);
  } catch {
    throw new Error("Failed to parse resume JSON from Claude response");
  }
}
