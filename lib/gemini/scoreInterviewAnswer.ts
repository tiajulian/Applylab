import { gemini, geminiOutputTokens } from "@/lib/gemini/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { extractJson } from "@/lib/anthropic/json";
import { calculateWpm } from "@/lib/interview/metrics";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { InterviewMode, InterviewStageType, StarScores, TechnicalAssessment, CorrectnessStatus } from "@/types";

const FEATURE = "interview-answer-score" as const;

export interface ScoreAnswerParams {
  userId: string;
  mode: InterviewMode;
  questionText: string;
  questionType: string;
  stageType: InterviewStageType;
  audioBase64?: string;
  mimeType?: string;
  durationSec?: number;
  textAnswer?: string;
  jobContext: {
    jobTitle: string;
    companyName: string;
    keyRequirements?: string[];
  };
  candidateEvidence: string;
}

export interface ScoreAnswerOutput {
  transcript: string;
  // null in 'coaching' mode (e.g. 'group' and 'coding' stages) - there is no STAR rubric to score
  // against, so this is never fabricated.
  star_scores: StarScores | null;
  technical_assessment?: TechnicalAssessment | null;
  filler_count: number;
  wpm: number;
  duration_sec: number;
  content_feedback: string;
  delivery_feedback: string;
  suggested_answer: string;
  needs_followup: boolean;
  followup_question: string | null;
}

const SIMULATION_SYSTEM_INSTRUCTION = `
You are an expert Australian interview assessor and coach for ApplyLab.
ApplyLab's core brand promise is: "We never invent anything."

Your evaluation standards:
1. Honest, calibrated feedback: Tell the candidate where they would genuinely lose points in a real interview. Avoid vague flattery.
2. STAR Scoring: Score each dimension from 1 to 5:
   - Situation (1-5): Was the context clear, concise, and relevant?
   - Task (1-5): Was the specific challenge, goal, or objective well-defined?
   - Action (1-5): Did the candidate focus on their personal contributions ("I" vs "We"), technical/operational decisions, and execution?
   - Result (1-5): Was there a tangible, quantifiable outcome or key lesson?
3. Delivery feedback & Fillers:
   - For audio input: Transcribe the speech accurately into English. Estimate the count of filler words (um, uh, like, you know, kind of, sort of, basically). Provide candid delivery feedback on clarity, conciseness, and vocal confidence.
   - For text input: Set filler_count to 0. Feedback should note that delivery was evaluated on structure and written clarity.
4. Suggested STAR Answer:
   - Reshape the candidate's real evidence into an exemplary STAR response.
   - CRITICAL GUARDRAIL: NEVER invent achievements, technologies, tools, employers, or metrics not present in their logged evidence or stated in their answer. If they lacked a metric, coach them on where to insert their real number.
5. Adaptive Follow-up:
   - If the candidate's answer was missing a critical step (e.g. no measurable Result, vague Action, or unaddressed gap), set "needs_followup": true and supply a direct "followup_question" (1 sentence).
   - If the answer was comprehensive and complete, set "needs_followup": false and "followup_question": null.
6. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

Output ONLY valid JSON matching this schema:
{
  "transcript": "...",
  "filler_count": 3,
  "star_scores": {
    "situation": 4,
    "task": 3,
    "action": 4,
    "result": 2,
    "summary": "Clear situation and strong personal action, but lacked a concrete quantifiable outcome."
  },
  "content_feedback": "...",
  "delivery_feedback": "...",
  "suggested_answer": "...",
  "needs_followup": true,
  "followup_question": "What was the measurable impact or metric after you completed that project?"
}
`.trim();

// Used only for 'group' stage sessions (mode: 'coaching'). A 1:1 voice AI cannot honestly
// observe multi-party group dynamics (airtime-sharing, interrupting, building on others' ideas),
// so this deliberately never produces a STAR score or any other numeric rating - see
// components/interview/GroupCoachingView.tsx for the same framing shown to the user up front.
const COACHING_SYSTEM_INSTRUCTION = `
You are an expert Australian assessment-centre coach for ApplyLab.
ApplyLab's core brand promise is: "We never invent anything."

The candidate is rehearsing a spoken response to a group-exercise reflection prompt, alone (no
real group is present). You CANNOT observe collaboration, airtime-sharing, or interrupting - do
not imply that you scored those things. Instead, evaluate only what is genuinely observable from
this solo response:
1. Whether their framing demonstrates awareness of collaborative behaviours (e.g. inviting other
   views, building on ideas, synthesizing rather than repeating) - as a qualitative note, never a
   1-5 numeric score.
2. Delivery: for audio input, transcribe accurately and estimate filler word count; for text
   input, set filler_count to 0.
3. Give one honest, calibrated coaching note (content_feedback) grounded strictly in what they
   actually said and their logged evidence - never invent scenarios, outcomes, or group dynamics
   that weren't described.
4. "suggested_answer" here is a reshaped coaching example of how to phrase the same real point
   more effectively in a group setting (e.g. inviting a quieter voice, framing a build-on) -
   NEVER invent achievements, tools, or outcomes not present in their evidence or answer.
5. Adaptive follow-up: if the reflection was shallow or missed a clear opportunity to demonstrate
   inclusive/consensus-building behaviour, set "needs_followup": true with a direct one-sentence
   "followup_question". Otherwise "needs_followup": false and "followup_question": null.
6. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

Do NOT include a "star_scores" field at all - group dynamics cannot be honestly scored 1-5 from a
solo response.

Output ONLY valid JSON matching this schema:
{
  "transcript": "...",
  "filler_count": 2,
  "content_feedback": "...",
  "delivery_feedback": "...",
  "suggested_answer": "...",
  "needs_followup": false,
  "followup_question": null
}
`.trim();

// Used for coding and technical questions.
// Evaluates candidate's written solution as a real technical interview coach:
// 1. Did I get it right? (Technical assessment: score 1-10, correctness, time assessment)
// 2. What did I do well? (Strengths grounded in the actual code/query)
// 3. What did I miss? (Relevant improvements without inventing weaknesses)
// 4. How should I do better in a real interview? (Coaching advice & single key Coach Note)
const CODING_SYSTEM_INSTRUCTION = `
You are an expert technical interviewer and interview coach for ApplyLab.
Your role is to evaluate the candidate's solution to a coding or technical interview question and teach them how to perform better in an actual technical interview.
ApplyLab's foundational brand promise is: "We never invent anything."

CRITICAL EVALUATION GUARDRAILS:
1. You are reading the candidate's submitted solution as text. You have NOT executed it. NEVER claim or imply that it ran, compiled, passed unit tests, or executed in a specific number of milliseconds. If execution performance was not measured, state that plainly rather than inventing performance metrics.
2. NEVER invent weaknesses or edge cases that are not genuinely relevant to the problem. If the answer is genuinely excellent, say: "No major technical issues. Your main opportunity is to make your reasoning more explicit."
3. NEVER claim the candidate used a technique they did not use or said something they did not say.

ADAPTIVE EVALUATION BY QUESTION TYPE:
- SQL Questions: Evaluate query correctness, aggregation (SUM, COUNT, AVG), filtering (WHERE, HAVING), joins (INNER, LEFT, conditions), grouping (GROUP BY), ordering (ORDER BY, ASC/DESC), NULL handling, query structure readability, and potential performance/indexing implications.
- Algorithm / Data Structure Questions (Python, JavaScript, etc.): Evaluate problem decomposition, algorithm choice, correctness, time complexity, space complexity, edge case handling (empty input, single item, boundary values), and potential optimisations.
- System Design Questions: Evaluate requirement clarification, architectural components, scalability, reliability, trade-offs, data modelling, and structured technical communication.
- General Technical Questions: Evaluate core technical knowledge, problem understanding, approach/reasoning, code quality, efficiency, and communication clarity.

EVALUATION OUTPUT CRITERIA:
1. Overall Score (1 to 10):
   - 10: Exceptional (flawless logic, optimal complexity, clean syntax)
   - 8-9: Strong Performance (correct solution with minor interview/communication opportunities)
   - 6-7: Good Attempt (mostly correct logic with minor edge-case gaps or suboptimal approach)
   - 1-5: Needs Improvement (significant logic flaws, incorrect query/code, or missed core requirements)
2. Correctness:
   - "correct": The solution produces the expected result and meets requirements.
   - "partially_correct": The main approach is sound but misses edge cases or has minor syntax/logical bugs.
   - "incorrect": The solution does not solve the problem or contains major logical errors.
   - Include a concise 1-2 sentence correctness_summary (e.g. "Your solution produces the expected result and correctly aggregates the transactions.").
3. Time Assessment:
   - Provide a realistic short assessment (e.g. "Good pace", "Quick solution", "Deliberate pace", or "Self-paced" if untimed).
4. What You Did Well (strengths):
   - Provide 2-4 concrete bullet points identifying SPECIFIC strengths in the user's actual code/query (e.g. "Correctly grouped transactions by category using GROUP BY", "Correctly used SUM(sale_amount) to calculate total sales").
   - NEVER use generic flattery like "Great job!". Ground every point in their code.
5. What to Improve (improvements):
   - Provide 1-3 actionable technical or interview improvements (e.g. "Explain your approach before writing the query", "Be prepared to discuss NULL handling for amounts", "State time complexity upfront").
   - Only list improvements genuinely relevant to this question.
6. Coaching Advice (coaching_advice):
   - Teach the candidate how to perform better in an actual interview (e.g. explain plan first, verbalize trade-offs, test boundary cases out loud).
   - Provide concrete sample wording the candidate could say in an interview (e.g. "Before writing the SQL, explain your plan in one or two sentences: 'I will group transactions by category, sum total sales, and sort descending.'").
7. Coach Note (coach_note):
   - The single most important takeaway from this attempt (1-2 sentences).
8. Adaptive Follow-up:
   - If the solution has a real bug, misses an edge case, or didn't state complexity, set "needs_followup": true with a direct one-sentence "followup_question" (e.g. "How would your query handle categories with NULL sale amounts?"). Otherwise "needs_followup": false and "followup_question": null.
9. Delivery metrics:
   - For audio input: Transcribe accurately and estimate filler count.
   - For text input: Set filler_count to 0.
10. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

Do NOT include a "star_scores" field.

Output ONLY valid JSON matching this schema:
{
  "transcript": "...",
  "filler_count": 0,
  "technical_assessment": {
    "score": 9,
    "score_label": "Strong Performance",
    "correctness": "correct",
    "correctness_label": "Correct",
    "correctness_summary": "Your solution produces the expected result.",
    "time_assessment": "Good pace",
    "strengths": [
      "Correctly grouped transactions by category using GROUP BY",
      "Correctly used SUM(sale_amount) to calculate total sales",
      "Correctly ordered the aggregated results from highest to lowest",
      "Used a concise and readable query structure"
    ],
    "improvements": [
      "Explain your approach in 1-2 sentences before writing the query",
      "Be prepared to discuss NULL handling for transaction amounts if asked"
    ],
    "coaching_advice": "Your SQL solution is correct. In a real interview, don't jump straight into writing the query. First, briefly explain your approach so the interviewer can follow your reasoning. For example: \\"I'll group the transactions by category, calculate the total sales for each category, and then sort those totals from highest to lowest.\\" Then write the query.",
    "coach_note": "Your SQL solution is correct and concise. Your biggest opportunity is to verbalise your reasoning before writing the query."
  },
  "content_feedback": "...",
  "delivery_feedback": "...",
  "suggested_answer": "...",
  "needs_followup": false,
  "followup_question": null
}
`.trim();

function buildPrompt(params: ScoreAnswerParams): string {
  const reqs = params.jobContext.keyRequirements?.join(", ") || "General role duties";
  const isCoding = params.stageType === "coding" || params.questionType === "coding";

  // For coding problems, omit resume work history bullets to keep the model strictly focused on
  // the technical problem and avoid spurious references to past employers in coaching advice.
  const evidenceSection = isCoding
    ? ""
    : `\nCANDIDATE LOGGED EVIDENCE:\n${params.candidateEvidence || "No prior logged evidence provided."}\n`;

  return `
TARGET JOB: ${params.jobContext.jobTitle} at ${params.jobContext.companyName}
STAGE TYPE: ${params.stageType}
KEY REQUIREMENTS: ${reqs}

INTERVIEW QUESTION:
"${params.questionText}" (Type: ${params.questionType})
${evidenceSection}
${params.textAnswer ? `CANDIDATE TYPED RESPONSE:\n"${params.textAnswer}"` : "CANDIDATE AUDIO RESPONSE: Attached in audio data."}

Evaluate the candidate's response now.
`.trim();
}

/**
 * Pure parsing/normalization of the Gemini response text into ScoreAnswerOutput fields - kept
 * separate from the network call so malformed/truncated/fenced model output can be unit tested
 * without hitting the live API. Never throws: any parse failure just falls back to defaults.
 */
export function parseScoreResponse(
  rawText: string,
  mode: InterviewMode,
  textAnswer: string | undefined,
  durationSec: number,
  hasAudio: boolean,
  stageType?: InterviewStageType,
  questionType?: string
): Omit<ScoreAnswerOutput, "duration_sec"> {
  const jsonStr = extractJson(rawText);

  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("scoreInterviewAnswer: failed to parse JSON response", err, rawText);
  }

  const transcript = String(parsed.transcript || textAnswer || "").trim();
  const wpm = calculateWpm(transcript, durationSec);

  const isCodingOrTechnical = stageType === "coding" || questionType === "coding" || Boolean(parsed.technical_assessment);

  let starScores: StarScores | null = null;
  let technicalAssessment: TechnicalAssessment | null = null;

  if (isCodingOrTechnical) {
    // Technical / Coding evaluation
    const rawTech = parsed.technical_assessment || {};
    const rawScore = Number(rawTech.score ?? parsed.score);
    const hasSubstantiveAnswer = transcript.trim().length >= 10;
    const defaultScore = hasSubstantiveAnswer ? 7 : 2;
    const score = Number.isFinite(rawScore) ? Math.min(10, Math.max(1, Math.round(rawScore))) : defaultScore;

    let correctness: CorrectnessStatus = "correct";
    const rawCorrectness = String(rawTech.correctness || "").toLowerCase();
    if (rawCorrectness.includes("partially") || rawCorrectness === "partial" || rawCorrectness === "partially_correct") {
      correctness = "partially_correct";
    } else if (rawCorrectness.includes("incorrect") || rawCorrectness === "wrong" || rawCorrectness === "fail") {
      correctness = "incorrect";
    } else if (rawCorrectness === "correct" || rawCorrectness === "pass") {
      correctness = "correct";
    } else {
      correctness = score >= 8 ? "correct" : score >= 5 ? "partially_correct" : "incorrect";
    }

    const correctnessLabel =
      correctness === "correct"
        ? "Correct"
        : correctness === "partially_correct"
        ? "Partially Correct"
        : "Incorrect";

    const defaultScoreLabel =
      score >= 9
        ? "Strong Performance"
        : score >= 7
        ? "Good Attempt"
        : "Needs Improvement";

    const scoreLabel = String(rawTech.score_label || defaultScoreLabel).trim();

    const correctnessSummary = String(
      rawTech.correctness_summary ||
        (correctness === "correct"
          ? "Your solution produces the expected result."
          : correctness === "partially_correct"
          ? "The core approach is sound but has minor bugs or edge-case gaps."
          : "The solution has logical errors or does not meet the key requirements.")
    ).trim();

    const timeAssessment = String(
      rawTech.time_assessment || (durationSec > 0 ? "Good pace" : "Self-paced")
    ).trim();

    const strengths: string[] = Array.isArray(rawTech.strengths) && rawTech.strengths.length > 0
      ? rawTech.strengths.map(String).map((s) => s.trim()).filter(Boolean)
      : [parsed.content_feedback ? String(parsed.content_feedback).trim() : (hasSubstantiveAnswer ? "Applied a structured approach to solving the problem." : "Attempted the question.")];

    const improvements: string[] = Array.isArray(rawTech.improvements) && rawTech.improvements.length > 0
      ? rawTech.improvements.map(String).map((s) => s.trim()).filter(Boolean)
      : [parsed.delivery_feedback ? String(parsed.delivery_feedback).trim() : (hasSubstantiveAnswer ? "Explain your reasoning and edge case handling explicitly before coding." : "Provide a complete solution addressing the problem requirements.")];

    const coachingAdvice = String(
      rawTech.coaching_advice || parsed.suggested_answer || "Explain your approach before writing code to demonstrate your thought process."
    ).trim();

    const defaultCoachNote =
      correctness === "correct"
        ? "Technically correct solution. Focus on verbalising your reasoning before coding."
        : correctness === "partially_correct"
        ? "Review core edge cases and verify logic before concluding your answer."
        : "Review the problem requirements and verify your logic before writing code.";

    const coachNote = String(rawTech.coach_note || defaultCoachNote).trim();

    technicalAssessment = {
      score,
      score_label: scoreLabel,
      correctness,
      correctness_label: correctnessLabel,
      correctness_summary: correctnessSummary,
      time_assessment: timeAssessment,
      strengths,
      improvements,
      coaching_advice: coachingAdvice,
      coach_note: coachNote,
    };
  } else if (mode === "simulation") {
    starScores = {
      situation: Math.min(5, Math.max(1, Number(parsed.star_scores?.situation) || 3)),
      task: Math.min(5, Math.max(1, Number(parsed.star_scores?.task) || 3)),
      action: Math.min(5, Math.max(1, Number(parsed.star_scores?.action) || 3)),
      result: Math.min(5, Math.max(1, Number(parsed.star_scores?.result) || 3)),
      summary: String(parsed.star_scores?.summary || "Completed answer evaluation."),
    };
  }

  const contentFeedback = technicalAssessment
    ? technicalAssessment.strengths.join(". ")
    : String(parsed.content_feedback || "Answer captured.");

  const deliveryFeedback = technicalAssessment
    ? technicalAssessment.improvements.join(". ")
    : String(parsed.delivery_feedback || "Delivery metrics recorded.");

  const suggestedAnswer = technicalAssessment
    ? technicalAssessment.coaching_advice
    : String(parsed.suggested_answer || transcript);

  return sanitizeDeep({
    transcript,
    star_scores: starScores,
    technical_assessment: technicalAssessment,
    filler_count: hasAudio && typeof parsed.filler_count === "number" ? Math.max(0, parsed.filler_count) : 0,
    wpm,
    duration_sec: durationSec,
    content_feedback: contentFeedback,
    delivery_feedback: deliveryFeedback,
    suggested_answer: suggestedAnswer,
    needs_followup: Boolean(parsed.needs_followup),
    followup_question: parsed.followup_question ? String(parsed.followup_question).trim() : null,
  });
}

export async function scoreInterviewAnswer(
  params: ScoreAnswerParams
): Promise<ScoreAnswerOutput> {
  const model = MODEL_BY_FEATURE[FEATURE].model;
  const promptText = buildPrompt(params);
  const isCoding = params.stageType === "coding" || params.questionType === "coding";
  const systemInstruction =
    isCoding
      ? CODING_SYSTEM_INSTRUCTION
      : params.mode === "coaching"
        ? COACHING_SYSTEM_INSTRUCTION
        : SIMULATION_SYSTEM_INSTRUCTION;

  let contents: any;

  if (params.audioBase64) {
    const rawMime = params.mimeType || "audio/webm";
    // Normalize audio mime type for Gemini
    const mimeType = rawMime.split(";")[0].trim();

    contents = [
      {
        role: "user",
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType || "audio/webm",
              data: params.audioBase64,
            },
          },
        ],
      },
    ];
  } else {
    contents = [
      {
        role: "user",
        parts: [{ text: promptText }],
      },
    ];
  }

  const response = await gemini.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature: 0.2,
      maxOutputTokens: 3000,
      thinkingConfig: { thinkingBudget: 1 },
    },
  });

  await logApiCost({
    userId: params.userId,
    feature: FEATURE,
    provider: MODEL_BY_FEATURE[FEATURE].provider,
    model,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    // See geminiOutputTokens for why this isn't just candidatesTokenCount (undercounted this
    // feature's real cost, even at thinkingBudget: 1 - thinking still runs; the budget isn't a
    // hard cap).
    outputTokens: geminiOutputTokens(response.usageMetadata),
  });

  const rawText = response.text ?? "{}";
  const durationSec = params.durationSec || 0;
  const parsedOutput = parseScoreResponse(
    rawText,
    params.mode,
    params.textAnswer,
    durationSec,
    Boolean(params.audioBase64),
    params.stageType,
    params.questionType
  );

  return {
    ...parsedOutput,
    duration_sec: durationSec,
  };
}
