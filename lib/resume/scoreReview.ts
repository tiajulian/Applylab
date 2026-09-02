import { anthropic } from "@/lib/anthropic/client";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { formatCompactJobAdFull } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import { analyzeResume, brevityScore, type DeterministicFindings } from "@/lib/resume/contentChecks";
import { checkResumeStructure, MAX_STRUCTURE_POINTS } from "@/lib/resume/structureChecks";
import { checkApplicationReadiness, MAX_READINESS_POINTS } from "@/lib/resume/readinessChecks";
import { hashForScoring } from "@/lib/resume/scoreCache";
import type {
  FactCheckTarget,
  ResumeContent,
  ResumeReviewCategory,
  ResumeReviewCategoryKey,
  ResumeReviewFinding,
  ResumeReviewResult,
} from "@/types";

const FEATURE = "score-review" as const;

export const MAX_CATEGORY_POINTS: Record<ResumeReviewCategoryKey, number> = {
  ats_structure: MAX_STRUCTURE_POINTS, // 20
  content_quality: 30,
  writing_quality: 20,
  job_optimization: 15,
  application_readiness: MAX_READINESS_POINTS, // 15
};

const REVIEW_SYSTEM_PROMPT = `
You are an expert executive recruiter and ATS specialist conducting an in-depth AI resume diagnostic.
You are evaluating the resume across two primary dimensions:
1. CONTENT QUALITY & IMPACT: Do bullet points convey concrete ownership, strong business outcomes, and credible accomplishments, or do they read as generic task lists?
2. WRITING CLARITY & CONCISENESS: Is the language sharp, active, and easy to skim, or is it vague, dense, or passive?
3. JOB / ROLE ALIGNMENT: How well does the experience and terminology align with the target role or job facts provided? (If no job facts are provided, evaluate alignment against standard industry expectations for the candidate's target title).

Identify up to 5 weak or improvable bullet points across the resume and provide high-impact, concrete rewrite suggestions for each.
Never invent facts, metrics, employers, or credentials not implied by the original bullet.
Australian English spelling throughout. Never use em dashes (—) in suggestions or messages; use commas, colons, or clean sentences.

Return ONLY a valid JSON object matching this exact structure, no prose, no preamble, no
markdown backticks, and nothing after the closing brace - a trailing summary or recommendations
section is not part of the response format, even a well-intentioned one:
{
  "impact": 0-100,
  "clarity": 0-100,
  "job_match": 0-100,
  "issues": [
    {
      "severity": "low" | "medium" | "high",
      "category": "content_quality" | "writing_quality" | "job_optimization",
      "bulletText": "<exact original bullet text>",
      "roleTitle": "<job title>",
      "roleCompany": "<company name>",
      "title": "<short 4-8 word issue title>",
      "message": "<clear explanation of why this bullet needs improvement>",
      "suggestion": "<concrete rewritten bullet>"
    }
  ],
  "missing_keywords": ["keyword1", "keyword2"]
}
`;

function buildReviewUserMessage(
  resume: ResumeContent,
  findings: DeterministicFindings,
  compactJobAd: CompactJobAd | null
): string {
  const jobContext = compactJobAd
    ? `TARGET JOB FACTS:\n${formatCompactJobAdFull(compactJobAd)}`
    : `TARGET JOB FACTS:\n(Generic Review Mode - No specific job ad attached. Target titles: ${resume.target_titles?.join(", ") || "General Professional"})`;

  // contact/referees are never referenced by any of the three judged dimensions - dropping them
  // cuts tokens off the resume payload for zero behaviour change. `education` stays in: JOB / ROLE
  // ALIGNMENT's missing_keywords check the job facts against the whole resume, and those often
  // include degree/certification requirements that only appear in a candidate's education
  // entries - stripping it would make a real qualification read as a missing keyword.
  const { contact: _contact, referees: _referees, ...scorable } = resume;

  return `
${jobContext}

RESUME CONTENT (JSON):
${JSON.stringify(scorable)}

Pre-computed writing stats for context:
- Bullets: ${findings.totalBullets} (avg ${findings.avgBulletLength} words)
- Strong verbs: ${findings.strongVerbPct}%
- Metric presence: ${findings.metricPct}%
- Summary present: ${findings.hasSummary}
`.trim();
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

interface ParsedClaudeIssue {
  severity?: string;
  category?: string;
  bulletText?: string;
  roleTitle?: string;
  roleCompany?: string;
  title?: string;
  message?: string;
  suggestion?: string;
}

function sanitizeClaudeFindings(rawIssues: unknown, resume: ResumeContent): ResumeReviewFinding[] {
  if (!Array.isArray(rawIssues)) return [];

  return rawIssues
    .filter((issue): issue is ParsedClaudeIssue => typeof issue === "object" && issue !== null)
    .map((issue, idx): ResumeReviewFinding | null => {
      const bulletText = typeof issue.bulletText === "string" ? issue.bulletText.trim() : "";
      const message = typeof issue.message === "string" ? issue.message.trim() : "";
      if (!message) return null;

      const title =
        typeof issue.title === "string" && issue.title.trim()
          ? issue.title.trim()
          : "Weak bullet impact or phrasing";
      const suggestion = typeof issue.suggestion === "string" ? issue.suggestion.trim() : undefined;
      const roleTitle = typeof issue.roleTitle === "string" ? issue.roleTitle.trim() : "";
      const roleCompany = typeof issue.roleCompany === "string" ? issue.roleCompany.trim() : "";
      const location = [roleTitle, roleCompany].filter(Boolean).join(" @ ") || "Work experience";

      const severity: ResumeReviewFinding["severity"] =
        issue.severity === "high" || issue.severity === "medium" || issue.severity === "low"
          ? issue.severity === "high"
            ? "hard_fail"
            : issue.severity === "medium"
            ? "warning"
            : "info"
          : "warning";

      let category_key: ResumeReviewCategoryKey = "content_quality";
      if (issue.category === "writing_quality") category_key = "writing_quality";
      else if (issue.category === "job_optimization") category_key = "job_optimization";

      let target: FactCheckTarget | undefined = undefined;
      if (bulletText) {
        for (let e = 0; e < (resume.experience ?? []).length; e++) {
          const bIdx = resume.experience[e].bullets.findIndex(
            (b) => b.trim().toLowerCase() === bulletText.toLowerCase()
          );
          if (bIdx !== -1) {
            target = { kind: "experienceBullet", index: e, bulletIndex: bIdx };
            break;
          }
        }
      }

      return {
        id: `claude-finding-${idx}-${category_key}`,
        category_key,
        severity,
        title,
        detail: message,
        fix_text: suggestion,
        resume_location: location,
        bullet_text: bulletText || undefined,
        target,
        status: "open" as const,
      };
    })
    .filter((f): f is ResumeReviewFinding => f !== null)
    .slice(0, 8);
}

export function buildDeterministicOnlyReview(
  resume: ResumeContent,
  compactJobAd: CompactJobAd | null,
  isUnlocked: boolean
): ResumeReviewResult {
  const analysis = analyzeResume(resume);
  const structResult = checkResumeStructure(resume);
  const readResult = checkApplicationReadiness(resume);

  // Fallback points:
  const atsStructureScore = structResult.score;

  // Content quality fallback (max 30 pts)
  const contentScoreBase = Math.round(
    (analysis.metricPct >= 40 ? 25 : analysis.metricPct >= 20 ? 20 : 15) +
      (analysis.totalBullets >= 4 ? 5 : 0)
  );
  const contentQualityScore = Math.max(0, Math.min(30, contentScoreBase));

  // Writing quality fallback (max 20 pts)
  const brevity = brevityScore(analysis);
  const writingBase = Math.round(
    (analysis.strongVerbPct * 0.4) +
      (brevity * 0.4) +
      (Math.max(0, 100 - (analysis.passiveVoiceBullets.length * 15 + analysis.buzzwordBullets.length * 10)) * 0.2)
  );
  const writingQualityScore = Math.max(0, Math.min(20, Math.round((writingBase / 100) * 20)));

  // Job optimization fallback (max 15 pts)
  let jobOptimizationScore = 10;
  if (resume.target_titles?.length > 0) jobOptimizationScore += 2;
  if (resume.skills?.length >= 5) jobOptimizationScore += 2;
  if (resume.tools?.length >= 2) jobOptimizationScore += 1;
  jobOptimizationScore = Math.min(15, jobOptimizationScore);

  const applicationReadinessScore = readResult.score;

  // Deterministic writing findings
  const writingFindings: ResumeReviewFinding[] = [];
  analysis.passiveVoiceBullets.slice(0, 3).forEach((bullet, i) => {
    writingFindings.push({
      id: `det-passive-${i}`,
      category_key: "writing_quality",
      severity: "info",
      title: "Passive voice phrasing",
      detail: "Written in passive voice. An active, ownership-oriented action verb conveys stronger initiative.",
      fix_text: "Lead with a direct action verb (e.g. 'Delivered', 'Spearheaded', 'Optimised').",
      resume_location: "Work experience",
      bullet_text: bullet,
      status: "open",
    });
  });

  analysis.buzzwordBullets.slice(0, 3).forEach(({ bullet, phrase }, i) => {
    writingFindings.push({
      id: `det-buzzword-${i}`,
      category_key: "writing_quality",
      severity: "info",
      title: `Overused cliché: "${phrase}"`,
      detail: `Contains the generic phrase "${phrase}". Recruiters favor concrete, quantified achievements over subjective claims.`,
      fix_text: `Replace "${phrase}" with a specific result or tool application.`,
      resume_location: "Work experience",
      bullet_text: bullet,
      status: "open",
    });
  });

  const jobFindings: ResumeReviewFinding[] = [];
  if (!compactJobAd) {
    jobFindings.push({
      id: "job-generic-mode",
      category_key: "job_optimization",
      severity: "info",
      title: "Resume-only review mode",
      detail: "Scored against standard industry expectations for your target role. Attach a specific job description to analyze precise ATS keyword matching.",
      fix_text: "Attach a job description to unlock tailored keyword gap analysis.",
      resume_location: "General",
      status: "open",
    });
  }

  const allFindings = [
    ...structResult.findings,
    ...writingFindings,
    ...jobFindings,
    ...readResult.findings,
  ];

  const overallScore =
    atsStructureScore +
    contentQualityScore +
    writingQualityScore +
    jobOptimizationScore +
    applicationReadinessScore;

  const categories: ResumeReviewCategory[] = [
    {
      key: "ats_structure",
      label: "ATS & structure",
      score: atsStructureScore,
      max_points: MAX_CATEGORY_POINTS.ats_structure,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "ats_structure").length,
    },
    {
      key: "content_quality",
      label: "Content quality",
      score: contentQualityScore,
      max_points: MAX_CATEGORY_POINTS.content_quality,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "content_quality").length,
    },
    {
      key: "writing_quality",
      label: "Writing quality",
      score: writingQualityScore,
      max_points: MAX_CATEGORY_POINTS.writing_quality,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "writing_quality").length,
    },
    {
      key: "job_optimization",
      label: "Job optimization",
      score: jobOptimizationScore,
      max_points: MAX_CATEGORY_POINTS.job_optimization,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "job_optimization").length,
    },
    {
      key: "application_readiness",
      label: "Application readiness",
      score: applicationReadinessScore,
      max_points: MAX_CATEGORY_POINTS.application_readiness,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "application_readiness").length,
    },
  ];

  return {
    overall_score: Math.max(0, Math.min(100, overallScore)),
    categories,
    findings: allFindings,
    content_hash: hashForScoring(JSON.stringify(resume)),
    scored_at: new Date().toISOString(),
    unlocked: isUnlocked,
  };
}

export async function scoreResumeReview(
  resume: ResumeContent,
  compactJobAd: CompactJobAd | null,
  userId: string,
  isUnlocked: boolean
): Promise<ResumeReviewResult> {
  const analysis = analyzeResume(resume);
  const structResult = checkResumeStructure(resume);
  const readResult = checkApplicationReadiness(resume);

  let claudeImpact = 65;
  let claudeClarity = 70;
  let claudeJobMatch = 70;
  let claudeFindings: ResumeReviewFinding[] = [];
  let missingKeywords: string[] = [];

  try {
    const message = await anthropic.messages.create({
      model: MODEL_BY_FEATURE[FEATURE].model,
      max_tokens: 3072,
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildReviewUserMessage(resume, analysis, compactJobAd) }],
    });

    await logApiCost({
      userId,
      feature: FEATURE,
      provider: MODEL_BY_FEATURE[FEATURE].provider,
      model: MODEL_BY_FEATURE[FEATURE].model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });

    const block = message.content[0];
    if (block.type === "text") {
      const parsed = JSON.parse(extractJson(block.text)) as Record<string, unknown>;
      claudeImpact = clamp(parsed.impact, 0, 100, 65);
      claudeClarity = clamp(parsed.clarity, 0, 100, 70);
      claudeJobMatch = clamp(parsed.job_match, 0, 100, 70);
      claudeFindings = sanitizeClaudeFindings(parsed.issues, resume);
      if (Array.isArray(parsed.missing_keywords)) {
        missingKeywords = parsed.missing_keywords.filter((k): k is string => typeof k === "string" && Boolean(k.trim()));
      }
    }
  } catch (error) {
    console.error("scoreResumeReview: Claude diagnostic pass failed, falling back to deterministic", error);
    return buildDeterministicOnlyReview(resume, compactJobAd, isUnlocked);
  }

  // 1. ATS & Structure (0-20)
  const atsStructureScore = structResult.score;

  // 2. Content Quality (0-30)
  const contentQualityScore = Math.max(0, Math.min(30, Math.round((claudeImpact / 100) * 30)));

  // 3. Writing Quality (0-20)
  const brevity = brevityScore(analysis);
  const writingBase = Math.round(
    (claudeClarity * 0.4) +
      (Math.min(100, analysis.strongVerbPct * 1.25) * 0.2) +
      (brevity * 0.2) +
      (Math.max(0, 100 - (analysis.passiveVoiceBullets.length * 15 + analysis.buzzwordBullets.length * 10)) * 0.2)
  );
  const writingQualityScore = Math.max(0, Math.min(20, Math.round((writingBase / 100) * 20)));

  // 4. Job Optimization (0-15)
  let jobOptimizationScore: number;
  const jobFindings: ResumeReviewFinding[] = [];

  if (compactJobAd) {
    jobOptimizationScore = Math.max(0, Math.min(15, Math.round((claudeJobMatch / 100) * 15)));
    if (missingKeywords.length > 0) {
      jobFindings.push({
        id: "job-missing-keywords",
        category_key: "job_optimization",
        severity: "warning",
        title: `Missing ${missingKeywords.length} target job keywords`,
        detail: `The job ad emphasizes the following core skills/tools not found in your resume: ${missingKeywords.slice(0, 6).join(", ")}.`,
        fix_text: `Integrate relevant keywords (${missingKeywords.slice(0, 4).join(", ")}) into your skills and experience bullets where you have verified experience.`,
        resume_location: "Key skills & experience",
        status: "open",
      });
    }
  } else {
    // Generic resume-only mode
    let baseGeneric = 10;
    if (resume.target_titles?.length > 0) baseGeneric += 2;
    if (resume.skills?.length >= 5) baseGeneric += 2;
    if (resume.tools?.length >= 2) baseGeneric += 1;
    jobOptimizationScore = Math.min(15, baseGeneric);

    jobFindings.push({
      id: "job-generic-mode",
      category_key: "job_optimization",
      severity: "info",
      title: "Resume-only review mode",
      detail: "Evaluated against general role criteria. Paste a specific job ad to analyze direct keyword tailoring against ATS filters.",
      fix_text: "Attach a job description for tailored keyword alignment.",
      resume_location: "General",
      status: "open",
    });
  }

  // 5. Application Readiness (0-15)
  const applicationReadinessScore = readResult.score;

  // Deterministic writing extras
  const writingFindings: ResumeReviewFinding[] = [];
  analysis.passiveVoiceBullets.slice(0, 2).forEach((bullet, i) => {
    writingFindings.push({
      id: `det-passive-${i}`,
      category_key: "writing_quality",
      severity: "info",
      title: "Passive voice phrasing",
      detail: "Written in passive voice. An active, ownership-oriented action verb conveys stronger leadership.",
      fix_text: "Lead with a direct action verb (e.g. 'Delivered', 'Spearheaded', 'Optimised').",
      resume_location: "Work experience",
      bullet_text: bullet,
      status: "open",
    });
  });

  analysis.buzzwordBullets.slice(0, 2).forEach(({ bullet, phrase }, i) => {
    writingFindings.push({
      id: `det-buzzword-${i}`,
      category_key: "writing_quality",
      severity: "info",
      title: `Overused cliché: "${phrase}"`,
      detail: `Contains the generic phrase "${phrase}". Recruiters favor concrete, quantified achievements over subjective claims.`,
      fix_text: `Replace "${phrase}" with a specific result or tool application.`,
      resume_location: "Work experience",
      bullet_text: bullet,
      status: "open",
    });
  });

  const allFindings = [
    ...structResult.findings,
    ...claudeFindings,
    ...writingFindings,
    ...jobFindings,
    ...readResult.findings,
  ];

  const overallScore =
    atsStructureScore +
    contentQualityScore +
    writingQualityScore +
    jobOptimizationScore +
    applicationReadinessScore;

  const categories: ResumeReviewCategory[] = [
    {
      key: "ats_structure",
      label: "ATS & structure",
      score: atsStructureScore,
      max_points: MAX_CATEGORY_POINTS.ats_structure,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "ats_structure").length,
    },
    {
      key: "content_quality",
      label: "Content quality",
      score: contentQualityScore,
      max_points: MAX_CATEGORY_POINTS.content_quality,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "content_quality").length,
    },
    {
      key: "writing_quality",
      label: "Writing quality",
      score: writingQualityScore,
      max_points: MAX_CATEGORY_POINTS.writing_quality,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "writing_quality").length,
    },
    {
      key: "job_optimization",
      label: "Job optimization",
      score: jobOptimizationScore,
      max_points: MAX_CATEGORY_POINTS.job_optimization,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "job_optimization").length,
    },
    {
      key: "application_readiness",
      label: "Application readiness",
      score: applicationReadinessScore,
      max_points: MAX_CATEGORY_POINTS.application_readiness,
      locked: !isUnlocked,
      finding_count: allFindings.filter((f) => f.category_key === "application_readiness").length,
    },
  ];

  return {
    overall_score: Math.max(0, Math.min(100, overallScore)),
    categories,
    findings: allFindings,
    content_hash: hashForScoring(JSON.stringify(resume)),
    scored_at: new Date().toISOString(),
    unlocked: isUnlocked,
  };
}

/**
 * Strips paywalled fields (detail and fix_text) when the review is locked for free users.
 */
export function sanitizeReviewForPlan(review: ResumeReviewResult, isUnlocked: boolean): ResumeReviewResult {
  if (isUnlocked) {
    return {
      ...review,
      unlocked: true,
      categories: review.categories.map((c) => ({ ...c, locked: false })),
    };
  }

  return {
    ...review,
    unlocked: false,
    categories: review.categories.map((c) => ({ ...c, locked: true })),
    findings: review.findings.map((f) => ({
      id: f.id,
      category_key: f.category_key,
      severity: f.severity,
      title: f.title,
      resume_location: f.resume_location,
      bullet_text: f.bullet_text,
      target: f.target,
      status: f.status,
      // paywalled fields omitted
      detail: undefined,
      fix_text: undefined,
    })),
  };
}
