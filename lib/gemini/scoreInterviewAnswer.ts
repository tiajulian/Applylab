import { gemini } from "@/lib/gemini/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { extractJson } from "@/lib/anthropic/json";
import { calculateWpm } from "@/lib/interview/metrics";
import type { InterviewMode, InterviewStageType, StarScores } from "@/types";

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
  // null in 'coaching' mode (e.g. 'group' stage) - there is no STAR rubric to score a group
  // reflection prompt against, so this is never fabricated.
  star_scores: StarScores | null;
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

function buildPrompt(params: ScoreAnswerParams): string {
  const reqs = params.jobContext.keyRequirements?.join(", ") || "General role duties";

  return `
TARGET JOB: ${params.jobContext.jobTitle} at ${params.jobContext.companyName}
STAGE TYPE: ${params.stageType}
KEY REQUIREMENTS: ${reqs}

INTERVIEW QUESTION:
"${params.questionText}" (Type: ${params.questionType})

CANDIDATE LOGGED EVIDENCE:
${params.candidateEvidence || "No prior logged evidence provided."}

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
  hasAudio: boolean
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

  const starScores: StarScores | null =
    mode === "simulation"
      ? {
          situation: Math.min(5, Math.max(1, Number(parsed.star_scores?.situation) || 3)),
          task: Math.min(5, Math.max(1, Number(parsed.star_scores?.task) || 3)),
          action: Math.min(5, Math.max(1, Number(parsed.star_scores?.action) || 3)),
          result: Math.min(5, Math.max(1, Number(parsed.star_scores?.result) || 3)),
          summary: String(parsed.star_scores?.summary || "Completed answer evaluation."),
        }
      : null;

  return {
    transcript,
    star_scores: starScores,
    // Enforced in code, not just prompted for: a text answer has no fillers to count, and a
    // cheaper/smaller model has been observed ignoring the "set filler_count to 0 for text
    // input" instruction (gemini-3.5-flash-lite did exactly this in a side-by-side comparison).
    filler_count: hasAudio && typeof parsed.filler_count === "number" ? Math.max(0, parsed.filler_count) : 0,
    wpm,
    content_feedback: String(parsed.content_feedback || "Answer captured."),
    delivery_feedback: String(parsed.delivery_feedback || "Delivery metrics recorded."),
    suggested_answer: String(parsed.suggested_answer || transcript),
    needs_followup: Boolean(parsed.needs_followup),
    followup_question: parsed.followup_question ? String(parsed.followup_question).trim() : null,
  };
}

export async function scoreInterviewAnswer(
  params: ScoreAnswerParams
): Promise<ScoreAnswerOutput> {
  const model = MODEL_BY_FEATURE[FEATURE].model;
  const promptText = buildPrompt(params);
  const systemInstruction =
    params.mode === "coaching" ? COACHING_SYSTEM_INSTRUCTION : SIMULATION_SYSTEM_INSTRUCTION;

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
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  });

  const rawText = response.text ?? "{}";
  const durationSec = params.durationSec || 0;
  const parsedOutput = parseScoreResponse(
    rawText,
    params.mode,
    params.textAnswer,
    durationSec,
    Boolean(params.audioBase64)
  );

  return {
    ...parsedOutput,
    duration_sec: durationSec,
  };
}
