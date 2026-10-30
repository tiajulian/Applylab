import { describe, it, expect, vi } from "vitest";
const { createMessage } = vi.hoisted(() => ({ createMessage: vi.fn() }));

// scoreReview.ts now imports anthropic/openai/gemini via the AI gateway re-export
// (lib/aiGateway/gateway.ts), which constructs all three provider clients eagerly at module load
// - even though this file only ever exercises the pure functions below, never the AI call itself.
// Stub them the same way gateway.test.ts does, or importing "./scoreReview" throws on a missing
// OPENAI_API_KEY in this test environment.
vi.mock("@/lib/anthropic/client", () => ({ anthropic: { messages: { create: createMessage } }, CLAUDE_MODEL: "claude-sonnet-4-6", CLAUDE_MODEL_FAST: "claude-haiku-4-5-20251001" }));
vi.mock("@/lib/openai/client", () => ({ openai: {} }));
vi.mock("@/lib/gemini/client", () => ({ gemini: {}, geminiOutputTokens: vi.fn() }));
vi.mock("@/lib/anthropic/costLog", async (original) => ({ ...await original<typeof import("@/lib/anthropic/costLog")>(), logApiCost: vi.fn().mockResolvedValue(undefined) }));

import { blankUnstatedTools, buildDeterministicOnlyReview, resumeToolNames, finalizeReview, sanitizeReviewForPlan, scoreResumeReview, MAX_CATEGORY_POINTS } from "./scoreReview";
import type { ResumeReviewCategory, ResumeReviewCategoryKey, ResumeReviewFinding } from "@/types";
import type { ResumeContent } from "@/types";
import { reviewQualityScore } from "./reviewAssessment";
import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";
import { analyzeResume } from "./contentChecks";

it("does not penalise an evidenced end-to-end pipeline as a buzzword", () => {
  const resume = createSampleResume();
  resume.experience[0].bullets = ["Owned the end-to-end pipeline for a new vendor accreditation program using dbt, Snowflake, and Tableau, reducing vendor accreditation time from 6.8 days to 1.4 days."];
  expect(analyzeResume(resume).buzzwordBullets).toEqual([]);
  const review = buildDeterministicOnlyReview(resume, null, true);
  expect(review.findings.filter((f) => f.category_key === "writing_quality" && f.id.startsWith("det-buzzword"))).toEqual([]);
});

function createSampleResume(): ResumeContent {
  return {
    contact: {
      name: "Sam Lee",
      email: "sam.lee@example.com",
      phone: "+61 400 999 888",
      location: "Brisbane, QLD",
      linkedin: "linkedin.com/in/samlee",
      work_rights: "Australian Citizen",
    },
    target_titles: ["Data Analyst", "BI Specialist"],
    summary: "Commercial data analyst with expertise in SQL, Power BI, and revenue optimization.",
    skills: ["SQL", "Power BI", "Python", "ETL", "Data Modeling", "Tableau"],
    tools: ["Data: Snowflake, dbt, BigQuery"],
    experience: [
      {
        job_title: "Senior Data Analyst",
        company: "Retail Group",
        company_description: "Leading multi-brand retailer",
        location: "Brisbane",
        start_date: "2022",
        end_date: "Present",
        bullets: [
          "Built customer churn forecasting dashboard in Power BI, increasing retention by 14%.",
          "Automated monthly executive reporting via SQL pipelines, saving 20 hours per month.",
        ],
      },
    ],
    projects: [],
    education: [
      {
        degree: "Bachelor of Information Technology",
        institution: "Queensland University of Technology",
        year: "2020",
        notes: "",
      },
    ],
    referees: [
      {
        name: "Manager One",
        title: "Head of Data",
        organisation: "Retail Group",
        phone: "+61 400 333 444",
        email: "mgr@retailgroup.com",
      },
      {
        name: "Manager Two",
        title: "Principal Analyst",
        organisation: "Retail Group",
        phone: "+61 400 555 666",
        email: "mgr2@retailgroup.com",
      },
    ],
  };
}

describe("scoreReview", () => {
  const respond = (result: unknown) => createMessage.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(result) }], usage: { input_tokens: 1, output_tokens: 1 },
  });

  it("does not guess a target for identical bullets across roles or projects", async () => {
    const resume = createSampleResume();
    const bullet = resume.experience[0].bullets[0];
    resume.projects = [{ title: "Reporting project", context: "", year: "2026", bullets: [bullet] }];
    respond({ impact: 80, clarity: 80, job_match: 80, missing_keywords: [], issues: [{ title: "Clarify the contribution", message: "Add detail.", bulletText: bullet, suggestion: "A clearer version." }] });
    const result = await scoreResumeReview(resume, null, null, true);
    expect(result.findings.find((finding) => finding.title === "Clarify the contribution")?.target).toBeUndefined();
  });

  it("targets a unique project bullet using its original wording", async () => {
    const resume = createSampleResume();
    resume.projects = [{ title: "Course project", context: "", year: "2026", bullets: ["Prepared project reports."] }];
    respond({ impact: 80, clarity: 80, job_match: 80, missing_keywords: [], issues: [{ title: "Clarify the contribution", message: "Add detail.", bulletText: "prepared project reports.", suggestion: "A clearer version." }] });
    const result = await scoreResumeReview(resume, null, null, true);
    expect(result.findings.find((finding) => finding.title === "Clarify the contribution")).toMatchObject({ target: { kind: "projectBullet", index: 0, bulletIndex: 0 }, bullet_text: "Prepared project reports.", resume_location: "Course project" });
  });

  it("keeps job fit separate from quality and does not invent a generic match", async () => {
    const valid = { impact: 80, clarity: 80, job_match: 90, issues: [], missing_keywords: [] };
    respond(valid);
    const generic = await scoreResumeReview(createSampleResume(), null, null, true);
    expect(generic.categories.find((c) => c.key === "job_optimization")).toMatchObject({ score: 0, assessment: "not_assessed" });
    expect(generic.categories.find((c) => c.key === "content_quality")?.assessment).toBe("ai");
    respond(valid);
    const targeted = await scoreResumeReview(createSampleResume(), { must_have_skills: ["SQL"], nice_to_have_skills: [], tools: [], key_responsibilities: [], keywords: [], notable_context: [], title: "Analyst", company: "Acme", seniority: "" }, null, true);
    expect(targeted.categories.find((c) => c.key === "job_optimization")?.assessment).toBe("ai");
    expect(targeted.overall_score).toBe(generic.overall_score);
  });

  it.each([{}, { impact: "80", clarity: 80, job_match: 80, issues: [], missing_keywords: [] }, { impact: 80, clarity: 80, job_match: 80, issues: "missing", missing_keywords: [] }])("labels incomplete AI results as basic checks", async (invalid) => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      respond(invalid);
      const result = await scoreResumeReview(createSampleResume(), null, null, true);
      expect(result.categories.find((c) => c.key === "content_quality")?.assessment).toBe("basic");
      expect(result.categories.find((c) => c.key === "job_optimization")?.assessment).toBe("not_assessed");
    } finally { quiet.mockRestore(); }
  });

  it("does not assess job match when extraction returned no usable requirements", async () => {
    respond({ impact: 80, clarity: 80, job_match: 95, issues: [], missing_keywords: [] });
    const result = await scoreResumeReview(createSampleResume(), { title: "Analyst" } as CompactJobAd, null, true);
    expect(result.categories.find((c) => c.key === "job_optimization")).toMatchObject({ assessment: "not_assessed", score: 0 });
  });
  it("normalises resume quality independently of the unassessed job category", () => {
    const resume = createSampleResume();
    const result = buildDeterministicOnlyReview(resume, null, false);

    expect(result.categories).toHaveLength(5);
    expect(result.overall_score).toBe(reviewQualityScore(result.categories));
    expect(result.categories.find((c) => c.key === "job_optimization")).toMatchObject({ score: 0, assessment: "not_assessed" });
    expect(result.overall_score).toBeGreaterThan(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);

    // Verify max point ceilings
    result.categories.forEach((cat) => {
      expect(cat.max_points).toBe(MAX_CATEGORY_POINTS[cat.key]);
      expect(cat.score).toBeLessThanOrEqual(cat.max_points);
    });
  });

  it("locates writing feedback in projects for first-job applicants", () => {
    const result = buildDeterministicOnlyReview({ ...createSampleResume(), experience: [], projects: [{ title: "Course reporting", context: "University", year: "2026", bullets: ["Was assigned reporting duties."] }] }, null, true);
    expect(result.findings.find((f) => f.id.startsWith("det-passive"))?.resume_location).toBe("Projects");
  });

  it("sanitizes paywalled fields for free users while preserving scores and finding metadata", () => {
    const resume = createSampleResume();
    const result = buildDeterministicOnlyReview(resume, null, false);
    const sanitized = sanitizeReviewForPlan(result, false);

    expect(sanitized.unlocked).toBe(false);
    expect(sanitized.overall_score).toBe(result.overall_score);
    expect(sanitized.categories.every((c) => c.locked)).toBe(true);

    // Findings must retain titles and locations, but detail & fix_text must be stripped
    sanitized.findings.forEach((finding) => {
      expect(finding.title).toBeDefined();
      expect(finding.category_key).toBeDefined();
      expect(finding.severity).toBeDefined();
      expect(finding.detail).toBeUndefined();
      expect(finding.fix_text).toBeUndefined();
    });
  });

  it("leaves detail and fix_text accessible for unlocked pro users", () => {
    const resume = createSampleResume();
    const result = buildDeterministicOnlyReview(resume, null, true);
    const unlocked = sanitizeReviewForPlan(result, true);

    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.categories.every((c) => !c.locked)).toBe(true);
    const hasFixes = unlocked.findings.some((f) => Boolean(f.fix_text));
    expect(hasFixes).toBe(true);
  });

  it("never sends a mechanical fix (replacement) to a free user, but keeps it for a paid one", () => {
    // A lowercase title makes the integrity check produce a finding that carries the corrected text.
    const resume = { ...createSampleResume(), experience: [{ ...createSampleResume().experience[0], job_title: "senior data analyst" }] };
    const paid = buildDeterministicOnlyReview(resume, null, true);
    expect(paid.findings.some((f) => f.replacement === "Senior Data Analyst")).toBe(true);

    const locked = sanitizeReviewForPlan(paid, false);
    expect(locked.findings.length).toBeGreaterThan(0);
    for (const finding of locked.findings) expect("replacement" in finding && finding.replacement !== undefined).toBe(false);
    expect(JSON.stringify(locked)).not.toContain("Senior Data Analyst");

    expect(sanitizeReviewForPlan(paid, true).findings.some((f) => f.replacement === "Senior Data Analyst")).toBe(true);
  });
});

describe("finalizeReview", () => {
  const category = (key: ResumeReviewCategoryKey, score: number, max: number): ResumeReviewCategory => ({
    key,
    label: key,
    score,
    max_points: max,
    locked: false,
    finding_count: 0,
  });
  const finding = (overrides: Partial<ResumeReviewFinding>): ResumeReviewFinding => ({
    id: "f",
    category_key: "job_optimization",
    severity: "warning",
    title: "Finding",
    resume_location: "",
    status: "open",
    ...overrides,
  });

  it("lists a problem once, in the right category, and open findings lower its category", () => {
    const result = finalizeReview({
      overall_score: 80,
      content_hash: "h",
      scored_at: "",
      unlocked: true,
      categories: [
        category("job_optimization", 15, 15),
        category("ats_structure", 20, 20),
        category("application_readiness", 15, 15),
        category("content_quality", 20, 30),
      ],
      findings: [
        finding({ id: "a", severity: "hard_fail", title: "Narrative mismatch" }),
        finding({ id: "b", severity: "hard_fail", title: "Target title points elsewhere" }),
        finding({ id: "c", category_key: "ats_structure", severity: "hard_fail", title: "Incomplete role details for Analyst", target: { kind: "experienceHeader", index: 1, field: "dates" } }),
        finding({ id: "d", category_key: "application_readiness", title: "Employment dates are missing or incomplete", target: { kind: "experienceHeader", index: 1, field: "dates" } }),
        finding({ id: "integrity-no-metrics", category_key: "application_readiness", severity: "info", title: "No quantified achievements anywhere" }),
      ],
    });

    expect(result.findings.filter((f) => f.target?.kind === "experienceHeader")).toHaveLength(1);
    expect(result.findings.find((f) => f.id === "integrity-no-metrics")?.category_key).toBe("content_quality");
    const job = result.categories.find((c) => c.key === "job_optimization")!;
    expect(job.score).toBeLessThan(job.max_points);
    expect(result.overall_score).toBe(reviewQualityScore(result.categories));
  });
});

describe("resumeToolNames", () => {
  it("splits Tools & Platforms rows, including names inside brackets, and skips Key Skills", () => {
    const resume = { ...createSampleResume(), tools: ["Cloud: AWS (S3, Lambda), Azure", "Data: dbt"], skills: ["Communication"] };
    expect(resumeToolNames(resume)).toEqual(["AWS", "S3", "Lambda", "Azure", "dbt"]);
  });
});

describe("blankUnstatedTools", () => {
  const tools = ["Snowflake", "dbt", "Excel", "SQL"];

  it("blanks a resume tool the source bullet never named, leaving blanks and the bullet's own tools alone", () => {
    const fix = "Maintained [add number] dbt models and [add data sources] pipelines in Snowflake using SQL.";
    expect(blankUnstatedTools(fix, "Responsible for maintaining data pipelines using SQL.", tools)).toBe(
      "Maintained [add number] [add tool] models and [add data sources] pipelines in [add tool] using SQL."
    );
  });

  it("matches whole names only: 'excellent' doesn't count as naming Excel", () => {
    expect(blankUnstatedTools("Built reports in Excel.", "Delivered excellent service.", tools)).toBe("Built reports in [add tool].");
  });

  it("doesn't mistake an everyday word for a capitalised tool name", () => {
    expect(blankUnstatedTools("Helped the team go live in Go.", "Helped the team go live.", ["Go"])).toBe(
      "Helped the team go live in [add tool]."
    );
  });

  it("never touches a tool name inside a blank or inside a longer word", () => {
    const fix = "Built [add what you built in dbt/Snowflake] with dbt-utils.";
    expect(blankUnstatedTools(fix, "Built models.", tools)).toBe(fix);
  });
});
