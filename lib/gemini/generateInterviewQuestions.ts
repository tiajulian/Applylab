// Despite the lib/gemini/ location (kept stable to avoid churning every caller's import path -
// see the equivalent lib/anthropic/parseJobAd.ts and scoreATS.ts, which stayed put through their
// own Claude -> OpenAI migration), this calls OpenAI, not Gemini. Question generation is pure
// text-to-text with no audio, so it moved to the same gpt-4o-mini + strict JSON schema pattern
// those files use - about 5-6x cheaper per call than Gemini 3.6 Flash for this job, and strict
// schema mode validates the response shape natively instead of hoping for clean markdown-fenced
// JSON. lib/gemini/scoreInterviewAnswer.ts stays on Gemini: it needs native audio input, which
// Gemini prices at the same rate as text while OpenAI's audio-capable tiers cost substantially
// more per token - see docs/interview-review.md for the cost comparison.
import { callGateway, openai } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { AiUnavailableError, QuotaExceededError } from "@/lib/aiGateway/errors";
import type { PressureLevel } from "@/lib/interview/setupConstants";
import { TONE_PROMPT_FRAGMENTS } from "@/lib/interview/tonePrompts";
import { buildEvidence, formatEvidenceForPrompt, type EvidenceItem } from "@/lib/interview/evidence";
import type { createClient } from "@/lib/supabase/server";
import type {
  ConfirmedBridgeItem,
  ConfirmedRoleDuty,
  InterviewStageType,
  Plan,
  StoryHint,
  UserProfile,
} from "@/types";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

type SupabaseServerClient = ReturnType<typeof createClient>;

const FEATURE = "interview-question-gen" as const;

export interface GapBridgeItem {
  competency: string;
  target_requirement: string;
}

export interface GenerateQuestionsInput {
  userId: string;
  supabase: SupabaseServerClient;
  tier: Plan;
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
  /** Exact number of main questions to return - the setup card promises this many. */
  questionCount: number;
  pressureLevel: PressureLevel;
  /** "Practise result-heavy questions": lean the set towards questions that test this part. */
  focusPart?: "situation" | "task" | "action" | "result";
}

export interface GeneratedQuestions {
  questions: PlannedQuestion[];
  /** True when any question came from the generic fallback set instead of the job/profile. */
  usedFallback: boolean;
}

export interface PlannedQuestion {
  order_index: number;
  question_type: string;
  question_text: string;
  interviewer_persona?: string;
  competency_focus: string;
  /** The candidate's own profile stories that could answer it (story hints); ids validated. */
  suggested_evidence?: StoryHint[];
}

const SYSTEM_INSTRUCTION = `
You are an expert Australian interview coach for ApplyLab.
ApplyLab's foundational brand promise is: "We never invent anything."
Every question you generate MUST be strictly grounded in the candidate's real logged experience and the target job requirements.
Never fabricate past employers, tools, achievements, or metrics the candidate did not log.

Rules for question design:
1. Generate exactly the number of questions given in QUESTION COUNT, realistic and tailored to the requested stage_type. Never repeat a question or ask the same thing twice in different words.
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
11. suggested_evidence: for each question, up to 3 ids (the [id] in square brackets in the
    evidence list) of the candidate's OWN logged roles, wins or projects that could answer it
    well. Only ids that appear in the list. An empty array when nothing fits, and always empty
    for 'coding' and 'group' questions. Never describe or invent a story, just pick ids.

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
          suggested_evidence: { type: "array", items: { type: "string" } },
        },
        required: ["order_index", "question_type", "question_text", "interviewer_persona", "competency_focus", "suggested_evidence"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

function formatProfileEvidence(profile: Partial<UserProfile>, evidence: EvidenceItem[]): string {
  const parts: string[] = [];

  // Roles, wins and projects, each with the [id] a story hint can cite.
  if (evidence.length > 0) {
    parts.push(`=== WORK EXPERIENCE, WINS AND PROJECTS (cite by [id]) ===\n${formatEvidenceForPrompt(evidence)}`);
  }

  if (profile.skills && profile.skills.length > 0) {
    parts.push(`=== SKILLS ===\n${profile.skills.join(", ")}`);
  }

  if (profile.tools && profile.tools.length > 0) {
    parts.push(`=== TOOLS ===\n${profile.tools.join(", ")}`);
  }

  return parts.join("\n\n");
}

const FOCUS_LINES: Record<NonNullable<GenerateQuestionsInput["focusPart"]>, string> = {
  situation: "Lean towards questions where setting the scene briefly and clearly matters.",
  task: "Lean towards questions that make the candidate spell out what they personally were responsible for.",
  action: "Lean towards questions that make the candidate explain the steps they took themselves and why.",
  result: "Lean towards behavioural questions where the outcome matters, so the candidate practises ending with what changed.",
};

function buildUserPrompt(input: GenerateQuestionsInput, count: number, avoid: string[], evidence: EvidenceItem[]): string {
  const profileSummary = formatProfileEvidence(input.profile, evidence);

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

  const tone = TONE_PROMPT_FRAGMENTS[input.pressureLevel];
  const avoidSection = avoid.length
    ? `=== ALREADY ASKED (DO NOT REPEAT OR REPHRASE) ===\n${avoid.map((q) => `- ${q}`).join("\n")}`
    : "";

  return `
STAGE TYPE: ${input.stageType}
QUESTION COUNT: ${count}
${tone ? `INTERVIEWER TONE: ${tone}\n` : ""}${input.focusPart ? `FOCUS: ${FOCUS_LINES[input.focusPart]}\n` : ""}
${jobDetails}

${profileSummary}

${confirmedBridge}

${gapBridge}

${confirmedDuties}

${avoidSection}

Generate exactly ${count} structured questions now. Remember: ground every question strictly in the candidate's real logged background or explicitly test honest navigation of real gaps.
`.trim();
}

/** Lowercased, punctuation-free form used to dedupe questions across the top-up call. */
export function normaliseQuestion(text: string): string {
  return text
    .replace(/^\[(.*?)\]\s*/, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses the model's JSON into planned questions; null when the response is unusable. */
export function parseQuestionsResponse(
  content: string | null | undefined,
  evidence: EvidenceItem[] = []
): PlannedQuestion[] | null {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  try {
    const parsed = content ? JSON.parse(content) : {};
    if (!Array.isArray(parsed.questions)) return null;
    const mapped: PlannedQuestion[] = parsed.questions
      .map((q: any, idx: number) => ({
        order_index: typeof q.order_index === "number" ? q.order_index : idx + 1,
        question_type: String(q.question_type || "behavioural"),
        question_text: String(q.question_text || "").trim(),
        interviewer_persona: q.interviewer_persona ? String(q.interviewer_persona) : undefined,
        competency_focus: String(q.competency_focus || "Core Competency"),
        suggested_evidence: storyHints(q.suggested_evidence, byId),
      }))
      .filter((q: PlannedQuestion) => q.question_text.length > 0);
    return sanitizeDeep(mapped);
  } catch (err) {
    console.error("generateInterviewQuestions: failed to parse JSON response", err, content);
    return null;
  }
}

/** Up to 3 known evidence ids as display hints; unknown ids are dropped. */
function storyHints(ids: unknown, byId: Map<string, EvidenceItem>): StoryHint[] {
  if (!Array.isArray(ids)) return [];
  const out: StoryHint[] = [];
  for (const raw of ids) {
    const item = byId.get(String(raw));
    if (!item || out.some((h) => h.id === item.id)) continue;
    const detail = item.text.length > 160 ? `${item.text.slice(0, 159).trimEnd()}…` : item.text;
    out.push({ id: item.id, label: item.label, detail });
    if (out.length === 3) break;
  }
  return out;
}

async function requestQuestions(
  input: GenerateQuestionsInput,
  count: number,
  avoid: string[]
): Promise<PlannedQuestion[] | null> {
  const model = MODEL_BY_FEATURE[FEATURE].model;
  const evidence = buildEvidence(input.profile);
  const prompt = buildUserPrompt(input, count, avoid, evidence);

  const response = await callGateway({
    supabase: input.supabase,
    userId: input.userId,
    tier: input.tier,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model,
    // Conservative worst case at gpt-4o-mini pricing: max_tokens (3000) alone is a small fraction
    // of a credit at $0.001/credit; a few credits covers input (full profile + job ad) + margin.
    estimatedCredits: 5,
    // Shadow mode (see GatewayCallParams.shadow): assertPaidPlan in the route is still the only
    // thing that can actually block a request - this route has no per-call cap yet (spec §7
    // explicitly calls out these interview flows as currently uncapped for a Pro login).
    shadow: true,
    invoke: () =>
      openai.chat.completions.create({
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
      }),
    extractUsage: (result) => ({
      inputTokens: result.usage?.prompt_tokens ?? 0,
      outputTokens: result.usage?.completion_tokens ?? 0,
    }),
  });

  await logApiCost({
    userId: input.userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });

  return parseQuestionsResponse(response.choices[0]?.message?.content, evidence);
}

/** Gateway refusals (out of credits, AI switched off) must reach the route's aiErrorResponse;
 *  anything else (a provider blip, bad JSON) degrades to the generic set instead of failing. */
async function requestQuestionsSafely(
  input: GenerateQuestionsInput,
  count: number,
  avoid: string[]
): Promise<PlannedQuestion[] | null> {
  try {
    return await requestQuestions(input, count, avoid);
  } catch (err) {
    if (err instanceof AiUnavailableError || err instanceof QuotaExceededError) throw err;
    console.error("generateInterviewQuestions: request failed", err);
    return null;
  }
}

/** Appends questions whose normalised text isn't already present, up to `count`. */
export function addUniqueQuestions(target: PlannedQuestion[], incoming: PlannedQuestion[], count: number): void {
  const seen = new Set(target.map((q) => normaliseQuestion(q.question_text)));
  for (const q of incoming) {
    if (target.length >= count) break;
    const key = normaliseQuestion(q.question_text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    target.push(q);
  }
}

/**
 * Returns exactly input.questionCount questions. If the model returns fewer, asks once more for
 * the shortfall; if still short, tops up from the generic set and reports usedFallback so the
 * session can say so (never silently starts with fewer than the setup card promised).
 */
export async function generateInterviewQuestions(
  input: GenerateQuestionsInput
): Promise<GeneratedQuestions> {
  const count = Math.max(1, input.questionCount);
  const questions: PlannedQuestion[] = [];

  addUniqueQuestions(questions, (await requestQuestionsSafely(input, count, [])) ?? [], count);

  if (questions.length < count) {
    const avoid = questions.map((q) => q.question_text);
    const topUp = await requestQuestionsSafely(input, count - questions.length, avoid);
    addUniqueQuestions(questions, topUp ?? [], count);
  }

  let usedFallback = false;
  if (questions.length < count) {
    usedFallback = true;
    console.warn("interview_fallback_used", {
      stageType: input.stageType,
      requested: count,
      tailored: questions.length,
    });
    addUniqueQuestions(questions, fallbackQuestions(input), count);
  }

  return {
    questions: questions.map((q, idx) => ({ ...q, order_index: idx + 1 })),
    usedFallback,
  };
}

/** Generic questions per stage, used only to top up a short or failed generation. Each set holds
 *  more than its stage needs (the general set covers Panel's 10), so one tailored question that
 *  happens to match a generic one can't leave the session short. */
export function fallbackQuestions(
  input: Pick<GenerateQuestionsInput, "stageType" | "jobTitle" | "companyName">
): PlannedQuestion[] {
  const role = input.jobTitle || "this role";
  const company = input.companyName || "our company";
  const make = (question_type: string, question_text: string, competency_focus: string): PlannedQuestion => ({
    order_index: 0,
    question_type,
    question_text,
    competency_focus,
  });

  if (input.stageType === "coding") {
    return [
      make("coding", "Given an array of integers and a target number, return the indexes of the two numbers that add up to the target. Explain the time and space complexity of your approach.", "Hash maps"),
      make("coding", "Write a function that returns the first character in a string that does not repeat. Return an empty string if every character repeats.", "String processing"),
      make("coding", "Given a list of time intervals as [start, end] pairs, merge every overlapping interval and return the result sorted by start time.", "Sorting and intervals"),
      make("coding", "Write a function that checks whether a string of brackets such as ()[]{} is balanced.", "Stacks"),
      make("coding", "Given a sorted array of integers, return a new array of the squares of each number, also sorted. Aim for better than sorting again.", "Two pointers"),
      make("coding", "Write a function that groups a list of words into sets of anagrams.", "Hashing and grouping"),
    ];
  }

  if (input.stageType === "group") {
    return [
      make("group_coaching", "Your group has 20 minutes to agree on a plan and two people disagree strongly. What would you say to move the discussion forward?", "Building consensus"),
      make("group_coaching", "One person in your group has not spoken yet. How would you bring them in without putting them on the spot?", "Including quieter voices"),
      make("group_coaching", "Halfway through the exercise the group is going in circles. How would you sum up where things stand and suggest a next step?", "Summarising and time-keeping"),
      make("group_coaching", "Someone builds on your idea in a direction you disagree with. How would you respond?", "Building on others' ideas"),
      make("group_coaching", "Your group is asked to present its decision in five minutes, but nobody has offered to do it. What would you do?", "Taking initiative"),
      make("group_coaching", "One person keeps talking over others. How would you keep the discussion fair without making it awkward?", "Managing group dynamics"),
    ];
  }

  return [
    make("motivation", `Tell me about yourself and what attracted you to the ${role} role at ${company}.`, "Role motivation and background"),
    make("behavioural", "Tell me about a time you solved a difficult problem at work. What did you do, and what happened as a result?", "Problem solving"),
    make("behavioural", "Describe a time you worked with someone whose way of working was very different from yours. How did you handle it?", "Working with others"),
    make("behavioural", "Tell me about a time something did not go to plan. What did you do next?", "Handling setbacks"),
    make("behavioural", "Give an example of when you had several priorities at once. How did you decide what came first?", "Prioritising"),
    make("behavioural", "Tell me about something you achieved at work that you are proud of. What was your part in it?", "Delivering results"),
    make("scenario", "Tell me about a time you had to learn something new quickly to get a job done.", "Learning quickly"),
    make("behavioural", "Describe a time you received feedback you did not expect. How did you respond?", "Taking feedback"),
    make("motivation", `What would you want to focus on in your first three months in ${role === "this role" ? role : `the ${role} role`}?`, "Role understanding"),
    make("behavioural", "Tell me about a time you helped a customer or colleague with a difficult request.", "Helping others"),
  ];
}
