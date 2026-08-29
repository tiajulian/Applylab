import { describe, it, expect } from "vitest";
import { buildDeterministicOnlyReview, sanitizeReviewForPlan, MAX_CATEGORY_POINTS } from "./scoreReview";
import type { ResumeContent } from "@/types";

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
  it("builds deterministic review with exact sum across all 5 categories matching overall score", () => {
    const resume = createSampleResume();
    const result = buildDeterministicOnlyReview(resume, null, false);

    expect(result.categories).toHaveLength(5);
    const categorySum = result.categories.reduce((sum, c) => sum + c.score, 0);
    expect(result.overall_score).toBe(categorySum);
    expect(result.overall_score).toBeGreaterThan(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);

    // Verify max point ceilings
    result.categories.forEach((cat) => {
      expect(cat.max_points).toBe(MAX_CATEGORY_POINTS[cat.key]);
      expect(cat.score).toBeLessThanOrEqual(cat.max_points);
    });
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
});
