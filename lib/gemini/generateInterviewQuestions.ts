// Despite the lib/gemini/ location (kept stable to avoid churning every caller's import path -
// see the equivalent lib/anthropic/parseJobAd.ts and scoreATS.ts, which stayed put through their
// own Claude -> OpenAI migration), this calls OpenAI, not Gemini. Question generation is pure
// text-to-text with no audio, so it moved to the same gpt-4o-mini + strict JSON schema pattern
// those files use - about 5-6x cheaper per call than Gemini 3.6 Flash for this job, and strict
// schema mode validates the response shape natively instead of hoping for clean markdown-fenced
// JSON. lib/gemini/scoreInterviewAnswer.ts stays on Gemini: it needs native audio input, which
// Gemini prices at the same rate as text while OpenAI's audio-capable tiers cost substantially
// more per token - see docs/interview-review.md for the cost comparison.
import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type {
  InterviewStageType,
  UserProfile,
  ConfirmedBridgeItem,
  ConfirmedRoleDuty,
} from "@/types";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

const FEATURE = "interview-question-gen" as const;

export interface GapBridgeItem {
  competency: string;
  target_requirement: string;
}

export interface GenerateQuestionsInput {
  userId: string;
  stageType: InterviewStageType;
  jobTitle: string;
  companyName: string;
  compactJobAd?: CompactJobAd | null;
  /** Raw job ad text, used only as a fallback when compactJobAd has nothing usable (a JD too
   * short to parse, or a parse that came back empty) - see buildUserPrompt. Never sent alongside
   * a populated compactJobAd. */
  jobDescription?: string;
  profile: Partial<UserProfile>;
  confirmedBridgeItems?: ConfirmedBridgeItem[];
  gapBridgeItems?: GapBridgeItem[];
  confirmedRoleDuties?: ConfirmedRoleDuty[];
}

export interface PlannedQuestion {
  order_index: number;
  question_type: string;
  question_text: string;
  interviewer_persona?: string;
  competency_focus: string;
}

const SYSTEM_INSTRUCTION = `
You are an expert Australian interview coach for ApplyLab.
ApplyLab's foundational brand promise is: "We never invent anything."
Every question you generate MUST be strictly grounded in the candidate's real logged experience and the target job requirements.
Never fabricate past employers, tools, achievements, or metrics the candidate did not log.

Rules for question design:
1. Generate between 3 and 5 high-impact, realistic questions tailored to the requested stage_type.
2. If there are known skill gaps in the input, include exactly ONE honest gap rehearsal question that invites the candidate to discuss their genuine learning curve or related foundational skills without bluffing or exaggerating.
3. For stage_type 'phone_screen': Focus on motivation, high-level career summary, key strengths, and role alignment.
4. For stage_type 'technical': Focus on real systems, technical decisions, problem-solving, and practical execution from their logged projects and past duties.
5. For stage_type 'panel': Provide distinct interviewer personas (e.g. "Hiring Manager", "Lead Engineer / Architect", "Cross-Functional Partner") assigned to each question.
6. For stage_type 'async_video': Structured, time-boxed one-way questions with clear scenario focus.
7. For stage_type 'group': Focus on collaborative problem-solving, stakeholder alignment, handling competing priorities, and consensus building.
8. For stage_type 'general': Classic behavioural STAR questions targeting core competencies of the job.
9. For stage_type 'coding': Set every question_type to 'coding'. Write self-contained algorithm or
   data-structure problems (clear inputs/outputs, no external references) at a level appropriate
   to the candidate's seniority and the job's must-have skills/tools - e.g. array/string
   manipulation, hash maps, trees, graphs, basic dynamic programming. Do not reference the
   candidate's logged employers or projects in the prompt itself (a coding problem is standalone,
   not evidence-grounded like other stages), but let their listed languages/tools guide difficulty
   and framing. Skip the honest-gap-question rule for this stage.
10. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

Return questions matching the required JSON schema. Use null for interviewer_persona when the
stage type doesn't call for one (only 'panel' generally needs distinct personas).
`.trim();

const QUESTIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          order_index: { type: "number" },
          question_type: {
            type: "string",
            enum: ["motivation", "behavioural", "technical", "gap", "scenario", "group_coaching", "coding"],
          },
          question_text: { type: "string" },
          interviewer_persona: { type: ["string", "null"] },
          competency_focus: { type: "string" },
        },
        required: ["order_index", "question_type", "question_text", "interviewer_persona", "competency_focus"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

function formatProfileEvidence(profile: Partial<UserProfile>): string {
  const parts: string[] = [];

  if (profile.work_experience && Array.isArray(profile.work_experience)) {
    const roles = profile.work_experience.map((exp) => {
      const wins = exp.wins?.map((w) => `- Win: ${w.text} ${w.metric ? `(Metric: ${w.metric})` : ""}`).join("\n  ") || "";
      return `Role: ${exp.job_title} at ${exp.company} (${exp.start_date} - ${exp.end_date || (exp.is_current ? "Present" : "")})\n  Description: ${exp.description || ""}\n  ${wins}`;
    }).join("\n\n");
    parts.push(`=== WORK EXPERIENCE ===\n${roles}`);
  }

  if (profile.projects && Array.isArray(profile.projects) && profile.projects.length > 0) {
    const projs = profile.projects.map((p) => {
      return `Project: ${p.title}\n  Context: ${p.context || ""}\n  Description: ${p.description || ""}\n  Tools: ${p.tools?.join(", ") || ""}\n  Outcome: ${p.outcome || ""} ${p.outcome_metric ? `(${p.outcome_metric})` : ""}`;
    }).join("\n\n");
    parts.push(`=== STANDALONE PROJECTS ===\n${projs}`);
  }

  if (profile.skills && profile.skills.length > 0) {
    parts.push(`=== SKILLS ===\n${profile.skills.join(", ")}`);
  }

  if (profile.tools && profile.tools.length > 0) {
    parts.push(`=== TOOLS ===\n${profile.tools.join(", ")}`);
  }

  return parts.join("\n\n");
}

function buildUserPrompt(input: GenerateQuestionsInput): string {
  const profileSummary = formatProfileEvidence(input.profile);

  // Replaces sending the raw job description (previously sliced to 3000 chars): a live
  // side-by-side found notable_context let the model reference genuinely specific detail (e.g.
  // "first hire for a new team") using fewer tokens than the raw text, and more reliably - the
  // raw-text version only picked up on 1 of 3 distinctive facts actually present in the ad,
  // notable_context's dedicated extraction surfaced 2 of 3 into an actual question. See
  // lib/anthropic/parseJobAd.ts for where this is extracted (once per ad, cached).
  const hasCompactJobAdContent = Boolean(
    input.compactJobAd?.must_have_skills?.length ||
      input.compactJobAd?.key_responsibilities?.length ||
      input.compactJobAd?.notable_context?.length
  );

  const jobDetails = [
    `Target Role: ${input.jobTitle || "Target Role"}`,
    `Company: ${input.companyName || "Target Company"}`,
    input.compactJobAd?.must_have_skills?.length ? `Must Have Skills: ${input.compactJobAd.must_have_skills.join(", ")}` : "",
    input.compactJobAd?.key_responsibilities?.length ? `Key Responsibilities: ${input.compactJobAd.key_responsibilities.join("; ")}` : "",
    input.compactJobAd?.notable_context?.length
      ? `Notable context about this role:\n${input.compactJobAd.notable_context.map((c) => `- ${c}`).join("\n")}`
      : "",
    // Fallback only - never sits alongside the compact fields above. Covers the case where
    // compactJobAd extraction came back empty (JD too short to parse, or a genuine parse miss):
    // without this, a session with no usable compactJobAd got zero job-specific grounding beyond
    // title/company, which made every generated question generic.
    !hasCompactJobAdContent && input.jobDescription
      ? `Job Description:\n${input.jobDescription.slice(0, 3000)}`
      : "",
  ].filter(Boolean).join("\n");

  const confirmedBridge = input.confirmedBridgeItems?.length
    ? `=== CONFIRMED MATCHED SKILLS ===\n${input.confirmedBridgeItems.map((i) => `- ${i.target_requirement} matched with ${i.source_job_title} at ${i.source_company} (${i.competency})`).join("\n")}`
    : "";

  const gapBridge = input.gapBridgeItems?.length
    ? `=== IDENTIFIED SKILL GAPS (INCLUDE ONE HONEST GAP QUESTION) ===\n${input.gapBridgeItems.map((g) => `- Missing / Growth Area: ${g.target_requirement} (${g.competency})`).join("\n")}`
    : "";

  const confirmedDuties = input.confirmedRoleDuties?.length
    ? `=== CONFIRMED ROLE DUTIES & OUTCOMES ===\n${input.confirmedRoleDuties.map((d) => `- Duty in ${d.job_title}: ${d.duty_text} (Outcome: ${d.outcome_text || "Delivered"} ${d.outcome_metric || ""})`).join("\n")}`
    : "";

  return `
STAGE TYPE: ${input.stageType}

${jobDetails}

${profileSummary}

${confirmedBridge}

${gapBridge}

${confirmedDuties}

Generate the structured questions now. Remember: ground every question strictly in the candidate's real logged background or explicitly test honest navigation of real gaps.
`.trim();
}

export async function generateInterviewQuestions(
  input: GenerateQuestionsInput
): Promise<PlannedQuestion[]> {
  const model = MODEL_BY_FEATURE[FEATURE].model;
  const prompt = buildUserPrompt(input);

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 3000,
    response_format: {
      type: "json_schema",
      json_schema: { name: "interview_questions", strict: true, schema: QUESTIONS_JSON_SCHEMA },
    },
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: prompt },
    ],
  });

  await logApiCost({
    userId: input.userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });

  const content = response.choices[0]?.message?.content;

  try {
    const parsed = content ? JSON.parse(content) : {};
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const mapped = parsed.questions.map((q: any, idx: number) => ({
        order_index: typeof q.order_index === "number" ? q.order_index : idx + 1,
        question_type: String(q.question_type || "behavioural"),
        question_text: String(q.question_text || "").trim(),
        interviewer_persona: q.interviewer_persona ? String(q.interviewer_persona) : undefined,
        competency_focus: String(q.competency_focus || "Core Competency"),
      }));
      return sanitizeDeep(mapped);
    }
  } catch (err) {
    console.error("generateInterviewQuestions: failed to parse JSON response", err, content);
  }

  // Fallback safe default questions if LLM response format fails
  return [
    {
      order_index: 1,
      question_type: "motivation",
      question_text: `Tell me about yourself and what attracted you to the ${input.jobTitle || "role"} at ${input.companyName || "our company"}?`,
      competency_focus: "Role motivation & background alignment",
    },
    {
      order_index: 2,
      question_type: "behavioural",
      question_text: "Can you walk through a complex challenge from your past experience and how you navigated it using the STAR approach?",
      competency_focus: "Problem solving & execution",
    },
    {
      order_index: 3,
      question_type: "technical",
      question_text: `Looking at the key requirements for this ${input.jobTitle || "position"}, tell us about a relevant project where you delivered measurable results.`,
      competency_focus: "Practical delivery & impact",
    },
  ];
}
