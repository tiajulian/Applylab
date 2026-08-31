import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";

const FEATURE = "profile-extract-skills" as const;

const SKILLS_JSON_SCHEMA = {
  type: "object",
  properties: {
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Concise hard skills, competencies, and tools extracted from the work experience.",
    },
  },
  required: ["skills"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `
You are an expert career consultant and ATS resume specialist.
Your task is to extract a comprehensive, highly relevant list of 5 to 15 key skills, core competencies, operational duties, methodologies, and tools demonstrated by the candidate's work experience roles and bullet points.

Rules:
- Extract concrete, professional skill terms (e.g. "Customer Service", "Food & Beverage Preparation", "Order Fulfilment", "Staff Training", "Quality Assurance", "Inventory Management", "Stakeholder Management", "SQL", "Agile Methodologies").
- Keep terms concise (1 to 4 words per skill), formatted cleanly in Title Case.
- Ground all skills in the candidate's actual responsibilities, actions, and achievements.
- Return between 5 and 15 strong, distinct skills.
`;

export async function extractSkillsFromExperience(experienceText: string, userId: string): Promise<string[]> {
  if (!experienceText || !experienceText.trim()) return [];

  const response = await openai.chat.completions.create({
    model: MODEL_BY_FEATURE[FEATURE].model,
    temperature: 0.2,
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: { name: "extracted_skills", strict: true, schema: SKILLS_JSON_SCHEMA },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Work Experience:\n${experienceText.slice(0, 15000)}` },
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
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { skills?: string[] };
    return (parsed.skills ?? [])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  } catch {
    return [];
  }
}
