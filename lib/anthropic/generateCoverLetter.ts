import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic/client";
import type { GenerateCoverLetterInput } from "@/types";

const COVER_LETTER_SYSTEM_PROMPT = `
You are an expert Australian cover letter writer. Write in a warm, professional, direct Australian tone — not overly formal like UK letters, not casual like US letters.

RULES:
- Maximum 400 words
- 4 paragraphs: Opening hook → Why this role → What you bring → Call to action
- Australian English spelling throughout
- Reference the specific company and role by name
- Never start with "I am writing to apply for..."
- End with "Kind regards" not "Sincerely"
- Do not repeat the resume — complement it

Return plain text only. No JSON.
`;

function buildUserMessage(input: GenerateCoverLetterInput): string {
  const { jobDescription, jobTitle, companyName, resumeContent } = input;

  return `
Job title: ${jobTitle}
Company: ${companyName}
Job description:
${jobDescription}

Candidate name: ${resumeContent.contact.name}
Candidate summary: ${resumeContent.summary}
Candidate key skills: ${resumeContent.skills.join(", ")}
Candidate most recent role: ${
    resumeContent.experience[0]
      ? `${resumeContent.experience[0].job_title} at ${resumeContent.experience[0].company}`
      : "N/A"
  }

Write a cover letter for this candidate, addressed to the hiring team at ${companyName}, tailored to the job description above.
`.trim();
}

export async function generateCoverLetter(input: GenerateCoverLetterInput): Promise<string> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: COVER_LETTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return block.text.trim();
}
