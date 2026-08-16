import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { formatCompactJobAdFull } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import { buildContentScoreResult, clampScore, type ContentScoreResult } from "@/lib/anthropic/scoreContent";
import type { DeterministicFindings } from "@/lib/resume/contentChecks";
import type { ATSScoreResult, ResumeContent } from "@/types";

const FEATURE = "score-resume-combined" as const;

export class ScoreResumeCombinedError extends Error {}

export interface CombinedScoreResult {
  ats: ATSScoreResult;
  content: ContentScoreResult;
}

/**
 * One Claude call judging the same resume from two independent angles at once, so the resume
 * JSON is only sent once instead of once per score (see scoreATS.ts and scoreContent.ts, which
 * this deliberately does NOT replace — they still back the free-tier "Score content" flow and
 * any standalone re-score). Only wired up behind the paid "Score resume" action
 * (app/api/resume/[id]/score/route.ts); free users never hit this.
 *
 * The two angles are judged independently in the prompt (never blended into one score) so this
 * degrades to the same quality as the two separate calls, not a diluted average of both.
 */
const COMBINED_SCORE_SYSTEM_PROMPT = `
You are reviewing one resume against one target job from two completely independent angles in a
single pass. Judge each angle only on its own criteria below - never blend them together.

ANGLE 1 - ATS KEYWORD MATCH: act as an ATS (Applicant Tracking System) keyword-matching engine,
replicating how SEEK, PageUp, Workday, and JobAdder parse resumes against a job.
1. Treat the must-have skills, tools, responsibilities, and keywords given in the job facts as
   the important terms to check for.
2. Determine which of those appear in the resume (matched_keywords) and which are missing
   (missing_keywords).
3. Produce an overall ATS match score from 0-100.
4. Give one short paragraph of feedback on how to improve the ATS score.

ANGLE 2 - WRITING QUALITY: act as an expert resume coach reviewing WRITING QUALITY only - not how
well the resume matches the job, just whether it reads as clear, impactful, and professional.
Rate two things on a 0-100 scale:
- "impact": do the bullets demonstrate concrete outcomes and ownership, or do they just list
  duties?
- "clarity": is the wording clear, specific, and easy to skim, or vague/rambling?
Then identify vague or weak bullets and suggest a concrete rewrite for up to the 3 weakest ones.
Never invent facts, employers, numbers, or achievements that aren't implied by the original
bullet - if a bullet lacks a metric, tighten the language rather than inventing one.

Australian English spelling throughout. Never use em dashes (—) in any feedback, message, or
suggestion; use a comma, colon, or separate sentence instead.

Return ONLY a valid JSON object with this exact structure, no markdown backticks, no preamble:
{
  "ats": {
    "score": 0,
    "matched_keywords": [],
    "missing_keywords": [],
    "feedback": ""
  },
  "content": {
    "impact": 0,
    "clarity": 0,
    "issues": [
      {
        "severity": "low" | "medium" | "high",
        "bulletText": "<the exact original bullet text, verbatim>",
        "roleTitle": "<the job title this bullet belongs to>",
        "roleCompany": "<the company this bullet belongs to>",
        "message": "<why this bullet is weak>",
        "suggestion": "<a concrete rewritten version>"
      }
    ]
  }
}
`;

function buildUserMessage(
  compactJobAd: CompactJobAd,
  resume: ResumeContent,
  findings: DeterministicFindings
): string {
  return `
JOB FACTS:
${formatCompactJobAdFull(compactJobAd)}

RESUME (JSON):
${JSON.stringify(resume)}

Automated writing-quality findings already computed (for context, don't just repeat these back):
- ${findings.totalBullets} bullets, average ${findings.avgBulletLength} words each
- ${findings.strongVerbPct}% start with a strong action verb
- ${findings.metricPct}% contain a number/metric
- Professional summary present: ${findings.hasSummary}
`.trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeAts(value: unknown): ATSScoreResult {
  const parsed = isPlainObject(value) ? value : {};
  const score = clampScore(parsed.score);
  const matched_keywords = Array.isArray(parsed.matched_keywords)
    ? parsed.matched_keywords.filter((v): v is string => typeof v === "string")
    : [];
  const missing_keywords = Array.isArray(parsed.missing_keywords)
    ? parsed.missing_keywords.filter((v): v is string => typeof v === "string")
    : [];
  const feedback = typeof parsed.feedback === "string" ? parsed.feedback : "";
  return { score, matched_keywords, missing_keywords, feedback };
}

/**
 * Throws (ScoreResumeCombinedError) on a total failure - Claude call failure, or a response that
 * isn't valid JSON at all - rather than degrading to a fabricated result. This is deliberately
 * stricter than scoreResumeContent's graceful degradation: that route's fallback is an honest
 * "the AI pass failed, here's the deterministic-only score", but there's no equivalent honest
 * partial result for the ATS half (a fake neutral 50 with empty keyword lists is indistinguishable
 * from a real assessment and would get persisted to the resume as if it were fresh). The route
 * catches this and returns an error to the client without writing anything to the DB, matching
 * the standalone ats-score route's existing throw-on-failure precedent.
 *
 * A response that DID come back but has a malformed/missing "ats" or "content" sub-object is a
 * different case, handled gracefully below by sanitizeAts and buildContentScoreResult (both
 * default missing fields rather than throwing) - only a fully unusable response throws here.
 */
export async function scoreResumeCombined(
  compactJobAd: CompactJobAd,
  resume: ResumeContent,
  findings: DeterministicFindings,
  userId: string
): Promise<CombinedScoreResult> {
  const message = await anthropic.messages.create({
    model: MODEL_BY_FEATURE[FEATURE],
    max_tokens: 3072,
    system: COMBINED_SCORE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(compactJobAd, resume, findings) }],
  });

  await logApiCost({
    userId,
    feature: FEATURE,
    model: MODEL_BY_FEATURE[FEATURE],
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new ScoreResumeCombinedError("Unexpected response type from Claude");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJson(block.text)) as Record<string, unknown>;
  } catch {
    throw new ScoreResumeCombinedError("Failed to parse combined score JSON from Claude response");
  }

  return {
    ats: sanitizeAts(parsed.ats),
    content: buildContentScoreResult(parsed.content, resume, findings),
  };
}
