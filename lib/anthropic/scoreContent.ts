import { anthropic, CLAUDE_MODEL_FAST } from "@/lib/anthropic/client";
import { extractJson } from "@/lib/anthropic/json";
import { brevityScore, completenessScore, type DeterministicFindings } from "@/lib/resume/contentChecks";
import type { ContentScoreBreakdown, ContentScoreIssue, ResumeContent } from "@/types";

export interface ContentScoreResult {
  score: number;
  breakdown: ContentScoreBreakdown;
  issues: ContentScoreIssue[];
}

const MAX_TEXT_LENGTH = 500;

const CONTENT_SCORE_SYSTEM_PROMPT = `
You are an expert resume coach reviewing the WRITING QUALITY of a resume — not how well it
matches any particular job, just whether it reads as clear, impactful, and professional.

Rate two things on a 0-100 scale:
- "impact": do the bullets demonstrate concrete outcomes and ownership, or do they just list duties?
- "clarity": is the wording clear, specific, and easy to skim, or vague/rambling?

Then identify vague or weak bullets and suggest a concrete rewrite for up to the 3 weakest
ones. Never invent facts, employers, numbers, or achievements that aren't implied by the
original bullet — if a bullet lacks a metric, tighten the language rather than inventing one.
Australian English spelling.

Return ONLY valid JSON, no prose, no markdown code fences, matching exactly:
{
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
`;

function buildUserMessage(resume: ResumeContent, findings: DeterministicFindings): string {
  return `
Resume (JSON):
${JSON.stringify(resume)}

Automated findings already computed (for context, don't just repeat these back):
- ${findings.totalBullets} bullets, average ${findings.avgBulletLength} words each
- ${findings.strongVerbPct}% start with a strong action verb
- ${findings.metricPct}% contain a number/metric
- Professional summary present: ${findings.hasSummary}
`.trim();
}

function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function truncate(value: unknown): string {
  return typeof value === "string" ? value.slice(0, MAX_TEXT_LENGTH) : "";
}

const VALID_SEVERITIES: ReadonlySet<string> = new Set(["low", "medium", "high"]);

function sanitizeClaudeIssues(value: unknown): ContentScoreIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => {
      const severity =
        typeof entry.severity === "string" && VALID_SEVERITIES.has(entry.severity)
          ? (entry.severity as ContentScoreIssue["severity"])
          : "low";
      const roleTitle = truncate(entry.roleTitle);
      const roleCompany = truncate(entry.roleCompany);
      const location = [roleTitle, roleCompany].filter(Boolean).join(" @ ") || "Work experience";
      const message = truncate(entry.message);
      const bulletText = typeof entry.bulletText === "string" ? truncate(entry.bulletText) : undefined;
      const suggestion = typeof entry.suggestion === "string" ? truncate(entry.suggestion) : undefined;

      const issue: ContentScoreIssue = { severity, location, message };
      if (bulletText) issue.bulletText = bulletText;
      if (suggestion) issue.suggestion = suggestion;
      return issue;
    })
    .filter((issue) => issue.message.trim().length > 0)
    .slice(0, 5);
}

const MAX_ISSUES_PER_CATEGORY = 5;

function buildDeterministicIssues(findings: DeterministicFindings): ContentScoreIssue[] {
  const issues: ContentScoreIssue[] = [];

  if (!findings.hasSummary) {
    issues.push({
      severity: "medium",
      location: "Professional summary",
      message: "No professional summary — recruiters often skim this first.",
    });
  }

  findings.passiveVoiceBullets.slice(0, MAX_ISSUES_PER_CATEGORY).forEach((bullet) => {
    issues.push({
      severity: "low",
      location: "Work experience",
      message: "Written in passive voice — an active, ownership-oriented verb reads stronger.",
      bulletText: bullet,
    });
  });

  findings.buzzwordBullets.slice(0, MAX_ISSUES_PER_CATEGORY).forEach(({ bullet, phrase }) => {
    issues.push({
      severity: "low",
      location: "Work experience",
      message: `Contains the cliché "${phrase}" — replace with a specific, quantified achievement.`,
      bulletText: bullet,
    });
  });

  return issues;
}

/**
 * Combines deterministic checks (brevity/completeness, always available) with one Claude
 * call (impact/clarity + bullet-level issues and rewrite suggestions). Degrades gracefully to
 * a deterministic-only result if the Claude call or its JSON response fails — this must never
 * throw, since the caller has already reserved a free-tier content-score slot by this point.
 */
export async function scoreResumeContent(
  resume: ResumeContent,
  findings: DeterministicFindings
): Promise<ContentScoreResult> {
  const brevity = brevityScore(findings);
  const completeness = completenessScore(resume, findings);
  const deterministicIssues = buildDeterministicIssues(findings);

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL_FAST,
      max_tokens: 2048,
      system: CONTENT_SCORE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(resume, findings) }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const parsed = JSON.parse(extractJson(block.text)) as Record<string, unknown>;
    const impact = clampScore(parsed.impact);
    const clarity = clampScore(parsed.clarity);
    const claudeIssues = sanitizeClaudeIssues(parsed.issues);

    const breakdown: ContentScoreBreakdown = { impact, clarity, brevity, completeness };
    const score = Math.round(impact * 0.3 + clarity * 0.3 + brevity * 0.2 + completeness * 0.2);

    return { score, breakdown, issues: [...claudeIssues, ...deterministicIssues] };
  } catch (error) {
    console.error("scoreResumeContent: Claude pass failed, degrading to deterministic-only", error);
    // Neutral midpoint for the Claude-derived categories — a failed call isn't evidence the
    // writing itself is bad. The overall score still carries real signal from brevity/completeness.
    const impact = 50;
    const clarity = 50;
    const breakdown: ContentScoreBreakdown = { impact, clarity, brevity, completeness };
    const score = Math.round(impact * 0.3 + clarity * 0.3 + brevity * 0.2 + completeness * 0.2);

    return { score, breakdown, issues: deterministicIssues };
  }
}
