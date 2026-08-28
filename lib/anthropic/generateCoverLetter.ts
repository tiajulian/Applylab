import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import { formatCompactJobAdFull } from "@/lib/anthropic/formatCompactJobAd";
import type { GenerateCoverLetterInput } from "@/types";

const FEATURE = "generate-cover-letter" as const;

const COVER_LETTER_SYSTEM_PROMPT = `
You are an expert Australian cover letter writer, working from a modern, recruiter-tested structure. Write in a warm, professional, direct Australian tone: not overly formal like UK letters, not casual like US letters.

STRUCTURE: three to four tight paragraphs (250 to 400 words total, leaning shorter). Expand to five paragraphs only if the content genuinely earns it and you stay under 400 words; never pad to hit a paragraph count. Every sentence must help answer one of: why this company, why this role, why hire this candidate, or why now - cut anything that doesn't.

1. Opening hook: start with the company or the role, not the candidate. Use one specific, genuine detail drawn from the job ad and connect it to the candidate's motivation. Fold "why this company" and "why this role" together here to keep it tight. Never open with "I am writing to apply for..." or any close variant.
2. Evidence: lead with the candidate's strongest relevant achievement, told as a short story: the achievement, what they did, and the real outcome. Draw only on the resume and profile details given below. If the candidate is changing careers or industries, this is where you bridge the gap: name the transferable experience given below and translate it into the language of the target role.
3. Fit: connect the candidate's experience to what the company needs. Keep this short, and merge it into the evidence paragraph if there isn't enough distinct content to justify its own paragraph.
4. Close: confident, with a clear call to action to discuss further. Never use "I hope" or "I believe".

KEYWORD ALIGNMENT:
Identify the most relevant skills and terms from the job ad and weave the true ones into the letter naturally, so it reads well to a person and aligns with automated screening. Only use terms the candidate's real experience below actually supports. Never keyword-stuff, and never claim a skill the candidate doesn't have.

HONESTY (critical):
- Company specifics come only from the job ad or company information given below. Never invent company facts, figures, clients, or statistics. If the job ad gives little to work with, speak genuinely to the role and mission rather than fabricating a detail.
- Evidence comes only from the candidate's real resume and profile details given below: never invent achievements, metrics, employers, or outcomes. With no quantified result given, describe the real contribution without inventing a number.
- The letter must be defensible in an interview: nothing the candidate couldn't stand behind.

FORMAT (the surrounding template renders the header and today's date, so you never generate those):
- Do not include a header, contact details, or today's date. Start directly with the greeting.
- Do not include a document title (no "Cover Letter", no "Application for [role]").
- Greeting: "Dear Hiring Manager," by default. If the job ad clearly names a hiring manager or contact, use their first name instead ("Dear [First Name],"). Never invent a name, and never use "Dear Sir/Madam" or "To Whom It May Concern".
- Sign-off: a professional Australian close ("Kind regards," is the default) on its own line, then the candidate's name on the next line, exactly as given below.
- Australian English spelling throughout, in short scannable paragraphs of two to four sentences.
- Never use em dashes (—) or en dashes (–); use a comma, colon, or separate sentence instead.

Return plain text only. No JSON, no markdown formatting.
`;

function formatExperienceForPrompt(resumeContent: GenerateCoverLetterInput["resumeContent"]): string {
  return resumeContent.experience
    .map((job) => {
      const bullets = job.bullets.map((bullet) => `  - ${bullet}`).join("\n");
      return `${job.job_title} at ${job.company} (${job.start_date} - ${job.end_date})${bullets ? `\n${bullets}` : ""}`;
    })
    .join("\n\n");
}

function formatProjectsForPrompt(resumeContent: GenerateCoverLetterInput["resumeContent"]): string {
  return resumeContent.projects
    .map((project) => {
      const bullets = project.bullets.map((bullet) => `  - ${bullet}`).join("\n");
      return `${project.title}${project.context ? ` (${project.context})` : ""}${bullets ? `\n${bullets}` : ""}`;
    })
    .join("\n\n");
}

function buildUserMessage(input: GenerateCoverLetterInput): string {
  const { compactJobAd, jobTitle, companyName, resumeContent } = input;
  const { contact, summary, target_titles, skills, tools } = resumeContent;

  const experienceBlock = formatExperienceForPrompt(resumeContent) || "N/A";
  const projectsBlock = formatProjectsForPrompt(resumeContent);

  return `
Job title: ${jobTitle}
Company: ${companyName}
Job facts:
${formatCompactJobAdFull(compactJobAd)}

Candidate name: ${contact.name}
Candidate target roles: ${target_titles.join(", ") || "N/A"}
Candidate summary: ${summary}
Candidate key skills: ${skills.join(", ") || "N/A"}
Candidate tools and platforms: ${tools.join(", ") || "N/A"}

Candidate work experience, most recent first (real, confirmed history - the only source for evidence and achievements):
${experienceBlock}
${projectsBlock ? `\nCandidate projects (real, confirmed side or freelance work):\n${projectsBlock}` : ""}

Write the cover letter body now, following the structure and rules in your system prompt.
`.trim();
}

export async function generateCoverLetter(input: GenerateCoverLetterInput, userId: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL_BY_FEATURE[FEATURE].model,
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: COVER_LETTER_SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(input) },
    ],
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
    throw new Error("Unexpected response type from GPT-5.6 Luna");
  }

  return sanitizeDashes(content.trim());
}
