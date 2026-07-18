import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic/client";
import type { ATSScoreResult, ResumeContent } from "@/types";

const ATS_SCORE_SYSTEM_PROMPT = `
You are an ATS (Applicant Tracking System) keyword-matching engine, replicating how SEEK, PageUp, Workday, and JobAdder parse resumes against a job description.

Compare the supplied resume against the supplied job description and:
1. Identify the important keywords, skills, and qualifications from the job description.
2. Determine which of those appear in the resume (matched_keywords) and which are missing (missing_keywords).
3. Produce an overall ATS match score from 0-100.
4. Give one short paragraph of feedback on how to improve the score.

Return ONLY a valid JSON object with this exact structure, no markdown backticks, no preamble:
{
  "score": 0,
  "matched_keywords": [],
  "missing_keywords": [],
  "feedback": ""
}
`;

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

export async function scoreATS(
  jobDescription: string,
  resumeContent: ResumeContent
): Promise<ATSScoreResult> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: ATS_SCORE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME (JSON):\n${JSON.stringify(
          resumeContent
        )}`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const json = extractJson(block.text);

  try {
    return JSON.parse(json) as ATSScoreResult;
  } catch {
    throw new Error("Failed to parse ATS score JSON from Claude response");
  }
}
