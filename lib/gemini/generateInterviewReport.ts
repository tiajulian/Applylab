// See lib/gemini/generateInterviewQuestions.ts for why this pure-text call moved to OpenAI
// (gpt-4o-mini + strict JSON schema) while lib/gemini/scoreInterviewAnswer.ts stays on Gemini
// for its native audio input.
import { openai } from "@/lib/openai/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { evaluatePacing } from "@/lib/interview/metrics";
import type {
  InterviewMode,
  InterviewStageType,
  InterviewTurn,
  InterviewReport,
  InterviewReportQuestionSummary,
} from "@/types";

const FEATURE = "interview-report-gen" as const;

export interface GenerateReportParams {
  userId: string;
  mode: InterviewMode;
  stageType: InterviewStageType;
  jobTitle: string;
  companyName: string;
  turns: InterviewTurn[];
}

const SIMULATION_SYSTEM_INSTRUCTION = `
You are an expert Australian interview assessor for ApplyLab.
ApplyLab's core brand promise is: "We never invent anything."
Analyze the full transcript and individual turn scores of this completed mock interview.

Provide an honest, calibrated executive summary of the candidate's interview performance:
1. Synthesize 2-4 key candidate strengths demonstrated in their answers.
2. Highlight 2-3 high-impact areas for improvement (e.g. quantifying results, answering missing-skill questions honestly without bluffing, pacing).
3. If any gap questions were answered, summarize how effectively and honestly the candidate managed the gap without fabricating skills.
4. For each question, provide a concise 1-sentence key takeaway.

Return the review matching the required JSON schema. Set honest_gap_review to null if no gap
question was part of this session.
`.trim();

// 'group' stage (mode: 'coaching') has no STAR rubric - this synthesizes a growth-coaching
// summary from the per-prompt coaching notes instead of a numeric performance score.
const COACHING_SYSTEM_INSTRUCTION = `
You are an expert Australian assessment-centre coach for ApplyLab.
ApplyLab's core brand promise is: "We never invent anything."
Analyze the transcripts and coaching notes from this group-exercise reflection practice session.
This was a solo rehearsal, not an observed group - do not claim to have assessed real group
dynamics (airtime-sharing, interrupting, etc.); only assess what the candidate's own words show.

Provide an honest, calibrated coaching summary:
1. Synthesize 2-4 strengths in how they framed collaborative, inclusive, or consensus-building language.
2. Highlight 2-3 high-impact areas to strengthen before a real assessment centre (e.g. inviting quieter voices, time-boxing, synthesizing rather than repeating).
3. For each prompt, provide a concise 1-sentence key takeaway.

Return the review matching the required JSON schema. Set honest_gap_review to null - group
coaching sessions don't have a skill-gap question.
`.trim();

const REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    strengths: { type: "array", items: { type: "string" } },
    areas_for_improvement: { type: "array", items: { type: "string" } },
    pacing_feedback: { type: "string" },
    filler_feedback: { type: "string" },
    honest_gap_review: { type: ["string", "null"] },
    question_takeaways: { type: "array", items: { type: "string" } },
  },
  required: [
    "strengths",
    "areas_for_improvement",
    "pacing_feedback",
    "filler_feedback",
    "honest_gap_review",
    "question_takeaways",
  ],
  additionalProperties: false,
};

export async function generateInterviewReport(
  params: GenerateReportParams
): Promise<InterviewReport> {
  const model = MODEL_BY_FEATURE[FEATURE].model;
  const isCoaching = params.mode === "coaching";

  // Calculate mathematical averages across completed turns. Skipped entirely in coaching mode -
  // turns never carry star_scores there (see scoreInterviewAnswer.ts), so there is nothing
  // honest to average; overall_score/star_averages stay null rather than defaulting to a
  // fabricated middle-of-the-road number.
  let totalSit = 0;
  let totalTask = 0;
  let totalAct = 0;
  let totalRes = 0;
  let validStarCount = 0;

  let totalWpm = 0;
  let validWpmCount = 0;
  let totalFillers = 0;

  for (const turn of params.turns) {
    if (!isCoaching && turn.star_scores) {
      totalSit += turn.star_scores.situation;
      totalTask += turn.star_scores.task;
      totalAct += turn.star_scores.action;
      totalRes += turn.star_scores.result;
      validStarCount += 1;
    }
    if (turn.wpm && turn.wpm > 0) {
      totalWpm += turn.wpm;
      validWpmCount += 1;
    }
    if (typeof turn.filler_count === "number") {
      totalFillers += turn.filler_count;
    }
  }

  const avgSit = validStarCount > 0 ? Number((totalSit / validStarCount).toFixed(1)) : 3;
  const avgTask = validStarCount > 0 ? Number((totalTask / validStarCount).toFixed(1)) : 3;
  const avgAct = validStarCount > 0 ? Number((totalAct / validStarCount).toFixed(1)) : 3;
  const avgRes = validStarCount > 0 ? Number((totalRes / validStarCount).toFixed(1)) : 3;

  // Scaled 0-100 overall score based on 4 STAR dimensions (max 20 total points)
  const sumScores = avgSit + avgTask + avgAct + avgRes;
  const overallScore = Math.round((sumScores / 20) * 100);

  const avgWpm = validWpmCount > 0 ? Math.round(totalWpm / validWpmCount) : 0;
  const pacingEval = evaluatePacing(avgWpm);

  const turnsSummary = params.turns.map((t, idx) => `
Turn ${idx + 1} (${t.question_type}${t.is_followup ? " - Follow-up" : ""}):
Question: "${t.question_text}"
Answer Transcript: "${t.transcript || "(No transcript)"}"
STAR Scores: S:${t.star_scores?.situation || "-"}, T:${t.star_scores?.task || "-"}, A:${t.star_scores?.action || "-"}, R:${t.star_scores?.result || "-"}
WPM: ${t.wpm || "-"}, Fillers: ${t.filler_count ?? "-"}
Turn Feedback: ${t.content_feedback || ""}
`).join("\n");

  const prompt = `
TARGET ROLE: ${params.jobTitle} at ${params.companyName}
STAGE TYPE: ${params.stageType}

INTERVIEW TURNS SUMMARY:
${turnsSummary}

Generate the overall performance review now.
`.trim();

  let parsed: any = {};
  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 2500,
      response_format: {
        type: "json_schema",
        json_schema: { name: "interview_report", strict: true, schema: REPORT_JSON_SCHEMA },
      },
      messages: [
        { role: "system", content: isCoaching ? COACHING_SYSTEM_INSTRUCTION : SIMULATION_SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ],
    });

    await logApiCost({
      userId: params.userId,
      feature: FEATURE,
      provider: MODEL_BY_FEATURE[FEATURE].provider,
      model,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    });

    const content = response.choices[0]?.message?.content;
    parsed = content ? JSON.parse(content) : {};
  } catch (err) {
    console.error("generateInterviewReport: report synthesis error", err);
  }

  const questionSummaries: InterviewReportQuestionSummary[] = params.turns.map((t, idx) => {
    const fallbackTakeaway = t.star_scores?.summary || t.content_feedback || "Turn completed.";
    const llmTakeaway = Array.isArray(parsed.question_takeaways) ? parsed.question_takeaways[idx] : null;

    return {
      order_index: t.order_index || idx + 1,
      question_text: t.question_text,
      question_type: t.question_type,
      star_scores: t.star_scores,
      wpm: t.wpm,
      duration_sec: t.duration_sec,
      filler_count: t.filler_count,
      key_takeaway: llmTakeaway ? String(llmTakeaway) : fallbackTakeaway,
    };
  });

  const strengths = Array.isArray(parsed.strengths) && parsed.strengths.length > 0
    ? parsed.strengths.map(String)
    : [
        "Structured communication and clear role context",
        "Clear demonstration of technical decision making",
      ];

  const areasForImprovement = Array.isArray(parsed.areas_for_improvement) && parsed.areas_for_improvement.length > 0
    ? parsed.areas_for_improvement.map(String)
    : [
        "Focus on quantifying the final impact (Result) of your initiatives",
        "Keep initial situation setups concise to emphasize personal actions",
      ];

  return {
    mode: params.mode,
    overall_score: isCoaching ? null : overallScore,
    star_averages: isCoaching
      ? null
      : {
          situation: avgSit,
          task: avgTask,
          action: avgAct,
          result: avgRes,
        },
    strengths,
    areas_for_improvement: areasForImprovement,
    delivery_summary: {
      avg_wpm: avgWpm,
      pacing_rating: pacingEval.rating,
      pacing_feedback: parsed.pacing_feedback ? String(parsed.pacing_feedback) : pacingEval.feedback,
      filler_feedback: parsed.filler_feedback ? String(parsed.filler_feedback) : `Recorded approximately ${totalFillers} filler words across all responses.`,
    },
    honest_gap_review: parsed.honest_gap_review ? String(parsed.honest_gap_review) : undefined,
    question_summaries: questionSummaries,
  };
}
