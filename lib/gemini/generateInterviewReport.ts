import { callGateway, openai } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { logApiCost } from "@/lib/anthropic/costLog";
import { evaluatePacing } from "@/lib/interview/metrics";
import { familyAverages, overallAverage, turnScores } from "@/lib/interview/rubrics";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type { createClient } from "@/lib/supabase/server";
import type {
  InterviewMode,
  InterviewStageType,
  InterviewTurn,
  InterviewReport,
  InterviewReportQuestionSummary,
  Plan,
} from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

const FEATURE = "interview-report-gen" as const;

export interface GenerateReportParams {
  userId: string;
  supabase: SupabaseServerClient;
  tier: Plan;
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
5. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

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
4. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

Return the review matching the required JSON schema. Set honest_gap_review to null - group
coaching sessions don't have a skill-gap question.
`.trim();

// 'coding' stage (mode: 'coaching') has no STAR rubric, same reasoning as the group-coaching
// instruction above - this synthesizes a technical-readiness summary from the per-question
// correctness/complexity notes instead of a numeric performance score.
const CODING_SYSTEM_INSTRUCTION = `
You are an expert technical interviewer for ApplyLab.
ApplyLab's core brand promise is: "We never invent anything."
Analyze the transcripts and per-question correctness/complexity notes from this coding practice
session. Each answer was graded by reading the candidate's submitted code, not executing it -
do not claim or imply any solution was actually run or tested.

Provide an honest, calibrated technical summary:
1. Synthesize 2-4 strengths shown across the solutions (e.g. correct approach, good complexity
   awareness, clear reasoning).
2. Highlight 2-3 high-impact areas to strengthen before a real technical interview (e.g. missed
   edge cases, suboptimal complexity, unclear narration of approach).
3. For each question, provide a concise 1-sentence key takeaway.
4. Punctuation: Strictly NEVER use em dashes (—) or en dashes (–); use standard hyphens (-) or commas instead.

Return the review matching the required JSON schema. Set honest_gap_review to null - coding
sessions don't have a skill-gap question.
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

/** One turn's marks for the report writer, on whichever rubric it was scored. */
function scoreLine(t: InterviewTurn): string {
  const scores = turnScores(t);
  if (!scores) return "Scores: none (coaching only)";
  return `${scores.definition.kind} scores: ${scores.parts.map((p) => `${p.label} ${p.score}`).join(", ")}`;
}

export async function generateInterviewReport(
  params: GenerateReportParams
): Promise<InterviewReport> {
  const model = MODEL_BY_FEATURE[FEATURE].model;
  const isCoaching = params.mode === "coaching";

  // Scores per rubric family (STAR, motivation, gap), never mixed, and an overall that is the
  // mean of each scored question's average on its own rubric. Coaching sessions get none: there
  // is nothing honest to average, so these stay null rather than a made-up middle number.
  const families = isCoaching ? {} : familyAverages(params.turns);
  const overall = isCoaching ? null : overallAverage(params.turns);
  const star = families.star;

  let totalWpm = 0;
  let validWpmCount = 0;
  let totalFillers = 0;

  for (const turn of params.turns) {
    if (turn.wpm && turn.wpm > 0) {
      totalWpm += turn.wpm;
      validWpmCount += 1;
    }
    if (typeof turn.filler_count === "number") {
      totalFillers += turn.filler_count;
    }
  }

  // Stored 0-100 (the 1-5 average x 20), as overall_score always has been.
  const overallScore = overall === null ? null : Math.round(overall * 20);

  const avgWpm = validWpmCount > 0 ? Math.round(totalWpm / validWpmCount) : 0;
  const pacingEval = evaluatePacing(avgWpm);
  const isCodingStage = params.stageType === "coding";
  const hasSpokenAudio = validWpmCount > 0;

  const turnsSummary = params.turns.map((t, idx) => {
    const tech = t.technical_assessment;
    if (tech || isCodingStage) {
      return `Turn ${idx + 1} (${t.question_type}${t.is_followup ? " - Follow-up" : ""}):
Question: "${t.question_text}"
Answer / Code: "${t.transcript || "(No answer)"}"
Technical Score: ${tech?.score ? `${tech.score}/10 (${tech.score_label})` : "-"}
Correctness: ${tech?.correctness_label || tech?.correctness || "-"} - ${tech?.correctness_summary || ""}
Strengths: ${tech?.strengths?.join("; ") || t.content_feedback || "-"}
Improvements: ${tech?.improvements?.join("; ") || t.delivery_feedback || "-"}
Coaching Advice: ${tech?.coaching_advice || t.suggested_answer || "-"}`;
    }

    return `Turn ${idx + 1} (${t.question_type}${t.is_followup ? " - Follow-up" : ""}):
Question: "${t.question_text}"
Answer Transcript: "${t.transcript || "(No transcript)"}"
${scoreLine(t)}
WPM: ${t.wpm || "-"}, Fillers: ${t.filler_count ?? "-"}
Turn Feedback: ${t.content_feedback || ""}`;
  }).join("\n\n");

  const prompt = `
TARGET ROLE: ${params.jobTitle} at ${params.companyName}
STAGE TYPE: ${params.stageType}

INTERVIEW TURNS SUMMARY:
${turnsSummary}

Generate the overall performance review now.
`.trim();

  let parsed: any = {};
  try {
    const response = await callGateway({
      supabase: params.supabase,
      userId: params.userId,
      tier: params.tier,
      feature: FEATURE,
      provider: MODEL_BY_FEATURE[FEATURE].provider,
      model,
      // Conservative worst case at gpt-4o-mini pricing: max_tokens (2500) alone is a small
      // fraction of a credit at $0.001/credit; a few credits covers the full turns transcript +
      // margin.
      estimatedCredits: 5,
      // Shadow mode (see GatewayCallParams.shadow): assertPaidPlan in the route is still the only
      // thing that can actually block a request. Doubly safe here since this whole call is
      // already inside a try/catch that degrades to default strengths/improvements on ANY
      // failure - same reasoning as scoreResumeContent.ts.
      shadow: true,
      invoke: () =>
        openai.chat.completions.create({
          model,
          temperature: 0.3,
          max_tokens: 2500,
          response_format: {
            type: "json_schema",
            json_schema: { name: "interview_report", strict: true, schema: REPORT_JSON_SCHEMA },
          },
          messages: [
            {
              role: "system",
              content: params.stageType === "coding"
                ? CODING_SYSTEM_INSTRUCTION
                : isCoaching
                  ? COACHING_SYSTEM_INSTRUCTION
                  : SIMULATION_SYSTEM_INSTRUCTION,
            },
            { role: "user", content: prompt },
          ],
        }),
      extractUsage: (result) => ({
        inputTokens: result.usage?.prompt_tokens ?? 0,
        outputTokens: result.usage?.completion_tokens ?? 0,
      }),
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
    const fallbackTakeaway = t.technical_assessment?.coach_note || t.star_scores?.summary || t.content_feedback || "Turn completed.";
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

  // Empty when the summary call fails: generic strengths the candidate never showed would be
  // made up. The report's fixes and scores come from the scored answers either way.
  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [];
  const areasForImprovement = Array.isArray(parsed.areas_for_improvement)
    ? parsed.areas_for_improvement.map(String)
    : [];

  const defaultPacingFeedback = isCodingStage && !hasSpokenAudio
    ? "Written code solutions evaluated on structure and approach."
    : pacingEval.feedback;

  const defaultFillerFeedback = isCodingStage && !hasSpokenAudio
    ? "Not applicable for written code solutions."
    : `Recorded approximately ${totalFillers} filler words across all responses.`;

  return sanitizeDeep({
    mode: params.mode,
    overall_score: overallScore,
    star_averages:
      star && ["situation", "task", "action", "result"].every((k) => typeof star[k] === "number")
        ? { situation: star.situation, task: star.task, action: star.action, result: star.result }
        : null,
    rubric_averages: families,
    strengths,
    areas_for_improvement: areasForImprovement,
    delivery_summary: {
      avg_wpm: avgWpm,
      pacing_rating: pacingEval.rating,
      pacing_feedback: parsed.pacing_feedback ? String(parsed.pacing_feedback) : defaultPacingFeedback,
      filler_feedback: parsed.filler_feedback ? String(parsed.filler_feedback) : defaultFillerFeedback,
    },
    honest_gap_review: parsed.honest_gap_review ? String(parsed.honest_gap_review) : undefined,
    question_summaries: questionSummaries,
  });
}
