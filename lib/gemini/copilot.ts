import { gemini } from "@/lib/gemini/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";

const FEATURE = "copilot" as const;

const SYSTEM_INSTRUCTION = `
You are an expert Australian job application assistant. Write a high-impact, professional
answer to a job application screening question, grounded strictly in the candidate's real
background given below - never invent skills, employers, or achievements not present in it.
Use Australian English spelling (e.g. key skills, team collaboration, outcomes).
Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.
Output ONLY the final suggested text answer. Do not include markdown meta-commentary, labels, or intros.
`;

export interface CopilotAnswerInput {
  question: string;
  jobTitle: string;
  jobDescriptionSnippet: string;
  format: string;
  wordLimit: number;
  skills: string;
  experienceSummary: string;
}

function buildUserMessage(input: CopilotAnswerInput): string {
  return `
Target Job Title: ${input.jobTitle || "Professional"}
Job Details: ${input.jobDescriptionSnippet || "Standard Australian corporate / tech role"}
Question: "${input.question}"

Candidate Skills: ${input.skills}
Candidate Past Experience: ${input.experienceSummary}

Format instructions:
- Use the ${input.format} style.
- Keep the response concise, authoritative, and within ~${input.wordLimit} words.
`.trim();
}

export async function generateCopilotAnswer(input: CopilotAnswerInput, userId: string): Promise<string> {
  const response = await gemini.models.generateContent({
    model: MODEL_BY_FEATURE[FEATURE].model,
    contents: buildUserMessage(input),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3,
      // thinkingBudget is not a hard cap on this model - a live test during implementation
      // measured 384 thoughtsTokenCount even at thinkingBudget: 1 (thinkingBudget: 0, fully
      // disabled, returns a 400 on this model). maxOutputTokens covers thinking + visible output
      // together, so a low cap here silently truncates the real answer after thinking eats most
      // of the budget - 400 (sized for the ~150-word answer alone) reproduced exactly that
      // mid-sentence cutoff. Sized well above the observed thinking overhead for headroom.
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 1 },
    },
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model: MODEL_BY_FEATURE[FEATURE].model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  });

  return sanitizeDashes((response.text ?? "").trim());
}
