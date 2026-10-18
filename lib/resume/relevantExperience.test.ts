import { describe, expect, it } from "vitest";
import { relevantExperience, stripUnbackedYears, summaryTargetTitle, yearsClaims } from "./relevantExperience";
import { runQualityGate } from "./qualityGate";
import type { ResumeContent, UserProfile, WorkExperienceEntry } from "@/types";

function role(job_title: string, start_date: string, end_date: string, is_current = false): WorkExperienceEntry {
  return { job_title, company: "Co", location: "", start_date, end_date, is_current, description: "", wins: [] };
}

// The QA case: analytics since 2023, a barista job from 2009.
const ROLES = [
  role("Analytics Engineer", "Mar 2023", "", true),
  role("Financial Crime Analyst", "Jan 2021", "Feb 2023"),
  role("Barista", "Jan 2009", "Dec 2020"),
];

describe("relevantExperience", () => {
  it("counts only roles related to the target title", () => {
    const result = relevantExperience(ROLES, "Analytics Engineer");
    expect(result.roles.map((r) => r.job_title)).toEqual(["Analytics Engineer"]);
    expect(result.years).toBeLessThan(5);
  });

  it("counts the same title even when it's only a role noun", () => {
    expect(relevantExperience([role("Senior Analyst", "Jan 2015", "Dec 2022")], "Analyst").years).toBeGreaterThanOrEqual(6);
  });

  it("doesn't count a shared role noun as the same field", () => {
    expect(relevantExperience([role("Store Manager", "Jan 2012", "Dec 2022")], "Product Manager").years).toBe(0);
  });

  it("counts overlapping roles once", () => {
    const result = relevantExperience([role("Data Analyst", "Jan 2020", "Dec 2021"), role("Senior Data Analyst", "Jan 2021", "Dec 2021")], "Data Analyst");
    expect(result.years).toBe(1);
  });

  it("targets the most recent role for a general resume", () => {
    expect(summaryTargetTitle("", ROLES)).toBe("Analytics Engineer");
    expect(summaryTargetTitle("Data Engineer", ROLES)).toBe("Data Engineer");
  });
});

describe("stripUnbackedYears", () => {
  const summary =
    "Analytics Engineer and Financial Crime Specialist with over 15 years of experience, specialising in SQL, dbt and fraud analytics.";

  it("cuts a years claim the relevant roles don't back", () => {
    const out = stripUnbackedYears(summary, 5);
    expect(yearsClaims(out)).toEqual([]);
    expect(out).toBe("Analytics Engineer and Financial Crime Specialist, specialising in SQL, dbt and fraud analytics.");
  });

  it("keeps a backed claim", () => {
    const backed = summary.replace("15", "5");
    expect(stripUnbackedYears(backed, 5)).toBe(backed);
  });

  it("drops even a small claim when there's under 2 relevant years", () => {
    expect(yearsClaims(stripUnbackedYears("Data analyst with 1+ years of experience in SQL.", 1))).toEqual([]);
  });
});

describe("quality gate with a target title", () => {
  const profile = { work_experience: ROLES, projects: [], education: [], skills: ["SQL"] } as unknown as UserProfile;
  const resume = (summary: string): ResumeContent => ({
    contact: { name: "Sam", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
    target_titles: [],
    summary,
    skills: [],
    tools: [],
    projects: [],
    experience: [],
    education: [],
    referees: [],
  });

  it("fails a career-length claim framed as field experience", () => {
    const result = runQualityGate({
      resume: resume("Analytics Engineer with 15+ years of experience."),
      profile,
      factCheckFlags: [],
      bridgeFactCheckFlags: [],
      targetTitle: "Analytics Engineer",
    });
    expect(result.checks.find((c) => c.id === "duration_claim")?.passed).toBe(false);
  });

  it("flags a number in the summary the profile never mentions", () => {
    const result = runQualityGate({
      resume: resume("Analytics Engineer who cut reporting time by 40% across 12 teams."),
      profile,
      factCheckFlags: [],
      bridgeFactCheckFlags: [],
      targetTitle: "Analytics Engineer",
    });
    const check = result.checks.find((c) => c.id === "summary_numbers");
    expect(check?.passed).toBe(false);
    expect(check?.details).toHaveLength(2);
  });

  it("doesn't mistake product names and grades for invented figures", () => {
    const result = runQualityGate({
      resume: resume("Analytics Engineer skilled in Microsoft 365, offering 24/7 support and a Year 12 certificate."),
      profile,
      factCheckFlags: [],
      bridgeFactCheckFlags: [],
      targetTitle: "Analytics Engineer",
    });
    expect(result.checks.find((c) => c.id === "summary_numbers")?.passed).toBe(true);
  });
});
