import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { formatCompactJobAdFull } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import type { ATSScoreResult, ResumeContent } from "@/types";

const FEATURE = "ats-score" as const;

const ATS_SCORE_SYSTEM_PROMPT = `
You are an ATS (Applicant Tracking System) keyword-matching engine, replicating how SEEK, PageUp, Workday, and JobAdder parse resumes against a job description.

Compare the supplied resume against the supplied job facts (a structured extraction of the job description's title, seniority, skills, tools, responsibilities, and keywords) and:
1. Treat the must-have skills, tools, responsibilities, and keywords given as the important terms to check for.
2. Determine which of those appear in the resume (matched_keywords) and which are missing (missing_keywords).
3. Produce an overall ATS match score from 0-100.
4. Give one short paragraph of feedback on how to improve the score. Never use em dashes (—) in
   the feedback; use a comma, colon, or separate sentence instead.
`;

const ATS_SCORE_JSON_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    matched_keywords: { type: "array", items: { type: "string" } },
    missing_keywords: { type: "array", items: { type: "string" } },
    feedback: { type: "string" },
  },
  required: ["score", "matched_keywords", "missing_keywords", "feedback"],
  additionalProperties: false,
};

export async function scoreATS(
  compactJobAd: CompactJobAd,
  resumeContent: ResumeContent,
  userId: string
): Promise<ATSScoreResult> {
  const response = await openai.chat.completions.create({
    model: MODEL_BY_FEATURE[FEATURE].model,
    temperature: 0,
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: { name: "ats_score", strict: true, schema: ATS_SCORE_JSON_SCHEMA },
    },
    messages: [
      { role: "system", content: ATS_SCORE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `JOB FACTS:\n${formatCompactJobAdFull(compactJobAd)}\n\nRESUME (JSON):\n${JSON.stringify(
          resumeContent
        )}`,
      },
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
    throw new Error("Unexpected response type from the AI provider");
  }

  try {
    return JSON.parse(content) as ATSScoreResult;
  } catch {
    throw new Error("Failed to parse ATS score JSON from the AI response");
  }
}
