import { anthropic, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import type { GenerateCoverLetterInput } from "@/types";

const COVER_LETTER_SYSTEM_PROMPT = `
You are an expert Australian cover letter writer. Write in a warm, professional, direct Australian tone — not overly formal like UK letters, not casual like US letters.

RULES:
- Maximum 400 words
- 4 paragraphs: Opening hook → Why this role → What you bring → Call to action
- Australian English spelling throughout
- Never use em dashes (—); use a comma, colon, or separate sentence instead
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

export async function generateCoverLetter(input: GenerateCoverLetterInput, userId: string): Promise<string> {
  // Note: this system prompt is ~160 tokens, far under Haiku's 4096-token minimum cacheable
  // prefix, so this breakpoint currently writes/reads nothing. Left in place in case the prompt
  // grows or the model changes; don't pad the prompt artificially just to reach the threshold.
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL_FAST,
    max_tokens: 1024,
    system: [{ type: "text", text: COVER_LETTER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  await logApiCost({
    userId,
    feature: "generate-cover-letter",
    model: CLAUDE_MODEL_FAST,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return sanitizeDashes(block.text.trim());
}
