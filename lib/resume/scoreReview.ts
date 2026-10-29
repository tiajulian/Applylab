import { callGateway, anthropic } from "@/lib/aiGateway/gateway";
import { MODEL_BY_FEATURE } from "@/lib/anthropic/models";
import { extractJson } from "@/lib/anthropic/json";
import { logApiCost } from "@/lib/anthropic/costLog";
import { formatCompactJobAdFull } from "@/lib/anthropic/formatCompactJobAd";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import { analyzeResume, brevityScore, type DeterministicFindings } from "@/lib/resume/contentChecks";
import { checkResumeStructure, MAX_STRUCTURE_POINTS } from "@/lib/resume/structureChecks";
import { checkApplicationReadiness, MAX_READINESS_POINTS } from "@/lib/resume/readinessChecks";
import { resumeScoreHash } from "@/lib/resume/resumeScoreHash";
import { escapeRegExp } from "@/lib/text/escapeRegExp";
import type { createClient } from "@/lib/supabase/server";
import type {
  FactCheckTarget,
  Plan,
  ResumeContent,
  ResumeReviewCategory,
  ResumeReviewCategoryKey,
  ResumeReviewFinding,
  ResumeReviewResult,
} from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

const FEATURE = "score-review" as const;

/**
 * Gateway metering is optional here for the same reason as parseProfileFromText (see that file's
 * ParseProfileGatewayContext comment): app/api/public/score-resume/route.ts calls this
 * anonymously, sometimes with no real user_id at all. Pass null there until spec §11's IP/device-
 * fingerprint design gives that flow its own real abuse control.
 */
export interface ScoreReviewGatewayContext {
  supabase: SupabaseServerClient;
  tier: Plan;
}

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

Also raise these judgement-call problems as issues (in addition to the bullets above, and within the same overall limit), because they are invisible to spell and format checks:
- IRRELEVANT BULLETS: a bullet with nothing to do with the target role or the candidate's stated career direction (for example coffee-making or stock-counting bullets on a financial-crime resume). Use category "job_optimization", copy the exact bulletText, and suggest either removing it or reframing a genuinely transferable skill (customer handling, cash reconciliation, working under pressure). Never invent a transferable claim.
- NARRATIVE MISMATCH: the target titles or summary point one way while the most recent or most prominent role points another. Use category "job_optimization", leave bulletText empty, name the role and the target that conflict, and suggest how to reposition (reorder emphasis, adjust the headline) without inventing experience.
- CONTRADICTORY CONTENT: a duration, seniority or timeline claim the dates in the resume don't support. Use category "content_quality" and leave bulletText empty unless one bullet is the culprit.
- READS LIKE A JOB DESCRIPTION: a bullet that describes the role the way a job ad does instead of what this candidate did - duty phrasing ("Responsible for...", "Support the..."), a purpose tail with no real result ("to support/enable/ensure..."), or vague job-ad terms ("various stakeholders", "business requirements", "data solutions", "cross-functional", "scalable"), with no concrete object, tool or team of its own. Use category "writing_quality", title exactly "Reads like a job description", copy the exact bulletText, and explain in one sentence that recruiters skim past wording that could sit in any job ad. The suggestion rewrites it in the candidate's own voice, keeping every real fact and the original action (maintained stays maintained, never upgraded to built or implemented), with fill-in blanks for the specifics only they know, each always starting with "add" (e.g. "[add tool]", "[add team]", "[add what you built]", "[add result]"). Never fill a blank yourself or invent a tool, team, object or result - and never name a tool or team the bullet itself doesn't name, even one that appears elsewhere in the resume; use a blank instead. Example: "Support the integration of new data sources to enable scalable reporting solutions" -> "Integrated [add what data sources] into [add tool] for [add team]'s reporting." Do not raise this for a bullet that already names a concrete thing, tool or team.
Placeholder names, missing dates, duplicate roles, role ordering and casing are detected separately; do not report those.
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

export const JOB_AD_FINDING_TITLE = "Reads like a job description";

/** Loose match: the model sometimes changes case, adds a full stop, or says "job ad". */
function isJobAdTitle(title: string): boolean {
  const normalized = title.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  return normalized.startsWith("reads like a job description") || normalized.startsWith("reads like a job ad");
}

/**
 * The resume's Tools & Platforms names: "Data: dbt, Snowflake" -> "dbt", "Snowflake", and
 * "Cloud: AWS (S3, Lambda), Azure" -> "AWS", "S3", "Lambda", "Azure". Key Skills are left out on
 * purpose: they're competencies ("Communication"), not tools to blank.
 */
export function resumeToolNames(resume: ResumeContent): string[] {
  const names: string[] = [];
  for (const line of resume.tools ?? []) {
    const list = line.split(/:(.+)/)[1] ?? line;
    for (const part of list.split(/,(?![^(]*\))/)) {
      const [outer, inner] = part.split(/\((.*)\)/);
      names.push(outer, ...(inner ? inner.split(",") : []));
    }
  }
  return Array.from(new Set(names.map((name) => name.trim()).filter((name) => name.length > 1)));
}

// Whole name only: not "Excel" inside "excellent", not "dbt" inside "dbt-utils".
const wholeWord = (name: string) => `(?<![\\w-])${escapeRegExp(name)}(?![\\w-])`;

/**
 * Backstop for the READS LIKE A JOB DESCRIPTION rule: its rewrite may only name a tool the source
 * bullet itself names. Any other resume tool written outside a blank becomes "[add tool]", so
 * applying the fix can never claim a tool was used for this work when the candidate never said so.
 */
export function blankUnstatedTools(fix: string, sourceBullet: string, toolNames: string[]): string {
  let result = fix;
  for (const name of toolNames) {
    // A capitalised name ("Go", "Excel", "Notion") matches only as written, so everyday words ("go
    // live", "make") are never mistaken for it; an all-lowercase name ("dbt") matches any casing.
    const caseFlag = /[A-Z]/.test(name) ? "" : "i";
    if (new RegExp(wholeWord(name), caseFlag).test(sourceBullet)) continue;
    result = result.replace(new RegExp(`${wholeWord(name)}(?![^\\[]*\\])`, `g${caseFlag}`), "[add tool]");
  }
  return result;
}

function sanitizeClaudeFindings(rawIssues: unknown, resume: ResumeContent): ResumeReviewFinding[] {
  if (!Array.isArray(rawIssues)) return [];
  const toolNames = resumeToolNames(resume);

  return rawIssues
    .filter((issue): issue is ParsedClaudeIssue => typeof issue === "object" && issue !== null)
    .map((issue, idx): ResumeReviewFinding | null => {
      const bulletText = typeof issue.bulletText === "string" ? issue.bulletText.trim() : "";
      const message = typeof issue.message === "string" ? issue.message.trim() : "";
      if (!message) return null;

      const rawTitle =
        typeof issue.title === "string" && issue.title.trim()
          ? issue.title.trim()
          : "Weak bullet impact or phrasing";
      const isJobAdFinding = isJobAdTitle(rawTitle);
      const title = isJobAdFinding ? JOB_AD_FINDING_TITLE : rawTitle;

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

      const rawSuggestion = typeof issue.suggestion === "string" ? issue.suggestion.trim() : undefined;
      // The real resume bullet is the only source of "stated" tools - never the model's own echo of
      // it, which could have a tool slipped in. Unmatched: every resume tool counts as unstated.
      const sourceBullet = target?.kind === "experienceBullet" ? resume.experience[target.index].bullets[target.bulletIndex] : "";
      const suggestion = isJobAdFinding && rawSuggestion ? blankUnstatedTools(rawSuggestion, sourceBullet, toolNames) : rawSuggestion;
      const roleTitle = typeof issue.roleTitle === "string" ? issue.roleTitle.trim() : "";
      const roleCompany = typeof issue.roleCompany === "string" ? issue.roleCompany.trim() : "";
      const location = [roleTitle, roleCompany].filter(Boolean).join(" @ ") || "Work experience";

      // Job-ad wording is worth fixing but never "Fix first" - set here, since the model's own rating varies.
      const severity: ResumeReviewFinding["severity"] = isJobAdFinding
        ? "warning"
        : issue.severity === "high" || issue.severity === "medium" || issue.severity === "low"
          ? issue.severity === "high"
            ? "hard_fail"
            : issue.severity === "medium"
            ? "warning"
            : "info"
          : "warning";

      let category_key: ResumeReviewCategoryKey = "content_quality";
      if (issue.category === "writing_quality") category_key = "writing_quality";
      else if (issue.category === "job_optimization") category_key = "job_optimization";

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

const SEVERITY_RANK: Record<ResumeReviewFinding["severity"], number> = { hard_fail: 3, warning: 2, info: 1 };
/** Most points an open finding of this severity leaves on the table in its category. */
const SEVERITY_PENALTY: Record<ResumeReviewFinding["severity"], number> = { hard_fail: 3, warning: 1, info: 0 };

/** Two checks reporting the same problem (a structure check and an integrity check both flagging
 * a role's missing dates, say) share a key, so it's listed once. */
function findingKey(finding: ResumeReviewFinding): string {
  const target = finding.target as { kind?: string; index?: number; field?: string; bulletIndex?: number } | undefined;
  if (/duplicate role/i.test(finding.title)) return `duplicate-role:${target?.index ?? ""}`;
  if (target?.kind === "experienceHeader" && target.field === "dates") return `role-dates:${target.index}`;
  return [finding.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), finding.bullet_text ?? "", target ? JSON.stringify(target) : ""].join("|");
}

/** Findings about numbers in bullets belong with achievements, not "ready to send". */
function categoryFor(finding: ResumeReviewFinding): ResumeReviewCategoryKey {
  if (finding.id === "integrity-no-metrics" || /quantified achievements/i.test(finding.title)) return "content_quality";
  return finding.category_key;
}

/**
 * Last pass over any review: one finding per problem (keeping the most severe), each in the
 * category it's about, and no category scoring full marks while it still has open warnings or
 * high-priority findings (a "15/15" next to two high-priority findings reads as a contradiction).
 * The overall score is the sum of the adjusted categories.
 */
export function finalizeReview(review: ResumeReviewResult): ResumeReviewResult {
  const byKey = new Map<string, ResumeReviewFinding>();
  for (const raw of review.findings) {
    const finding = { ...raw, category_key: categoryFor(raw) };
    const key = findingKey(finding);
    const existing = byKey.get(key);
    if (!existing || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severity]) byKey.set(key, finding);
  }
  const findings = Array.from(byKey.values());

  const categories = review.categories.map((category) => {
    const open = findings.filter((f) => f.category_key === category.key && f.status !== "applied" && f.status !== "dismissed");
    const penalty = open.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
    const cap = penalty > 0 ? Math.max(0, category.max_points - penalty) : category.max_points;
    return {
      ...category,
      score: Math.min(category.score, cap),
      finding_count: findings.filter((f) => f.category_key === category.key).length,
    };
  });

  return {
    ...review,
    findings,
    categories,
    overall_score: Math.max(0, Math.min(100, categories.reduce((sum, c) => sum + c.score, 0))),
  };
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

  return finalizeReview({
    overall_score: Math.max(0, Math.min(100, overallScore)),
    categories,
    findings: allFindings,
    content_hash: resumeScoreHash(resume),
    scored_at: new Date().toISOString(),
    unlocked: isUnlocked,
  });
}

export async function scoreResumeReview(
  resume: ResumeContent,
  compactJobAd: CompactJobAd | null,
  userId: string | null,
  isUnlocked: boolean,
  gatewayContext?: ScoreReviewGatewayContext | null
): Promise<ResumeReviewResult> {
  // Outside the try below on purpose: a metered caller without a user is a programming error, not
  // a provider failure to degrade around.
  if (gatewayContext && !userId) throw new Error("scoreResumeReview: gatewayContext requires a userId");
  const analysis = analyzeResume(resume);
  const structResult = checkResumeStructure(resume);
  const readResult = checkApplicationReadiness(resume);

  let claudeImpact = 65;
  let claudeClarity = 70;
  let claudeJobMatch = 70;
  let claudeFindings: ResumeReviewFinding[] = [];
  let missingKeywords: string[] = [];

  try {
    const invoke = () =>
      anthropic.messages.create({
        model: MODEL_BY_FEATURE[FEATURE].model,
        max_tokens: 3072,
        system: REVIEW_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildReviewUserMessage(resume, analysis, compactJobAd) }],
      });

    const message = gatewayContext
      ? await callGateway({
          supabase: gatewayContext.supabase,
          userId: userId!,
          tier: gatewayContext.tier,
          feature: FEATURE,
          provider: MODEL_BY_FEATURE[FEATURE].provider,
          model: MODEL_BY_FEATURE[FEATURE].model,
          // Conservative worst case at Claude Haiku pricing ($1/$5 per million - see costLog.ts):
          // max_tokens (3072) alone is ~15 credits at $0.001/credit, plus headroom for the resume
          // + job ad in the prompt.
          estimatedCredits: 20,
          // Shadow mode (see GatewayCallParams.shadow): doubly safe here since this whole call is
          // already inside a try/catch that degrades to a deterministic-only review on ANY
          // failure - same reasoning as scoreResumeContent.ts.
          shadow: true,
          invoke,
          extractUsage: (result) => ({
            inputTokens: result.usage.input_tokens,
            outputTokens: result.usage.output_tokens,
          }),
        })
      : await invoke();

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

  return finalizeReview({
    overall_score: Math.max(0, Math.min(100, overallScore)),
    categories,
    findings: allFindings,
    content_hash: resumeScoreHash(resume),
    scored_at: new Date().toISOString(),
    unlocked: isUnlocked,
  });
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
