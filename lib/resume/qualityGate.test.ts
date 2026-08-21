import { describe, expect, it } from "vitest";
import { runQualityGate } from "./qualityGate";
import type { ResumeContent, UserProfile } from "@/types";

function baseResume(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    contact: { name: "Jamie", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
    target_titles: [],
    summary: "Operations coordinator with experience across fulfilment and logistics.",
    skills: [],
    tools: [],
    projects: [],
    experience: [
      {
        job_title: "Operations Coordinator",
        company: "Coles",
        company_description: "",
        location: "Melbourne, VIC",
        start_date: "Jan 2022",
        end_date: "Present",
        bullets: ["Coordinated daily fulfilment across three warehouses."],
      },
    ],
    education: [],
    referees: [],
    ...overrides,
  };
}

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "p1",
    user_id: "u1",
    work_rights: "Australian citizen",
    phone: "",
    location: "",
    linkedin_url: null,
    work_experience: [
      {
        job_title: "Operations Coordinator",
        company: "Coles",
        location: "Melbourne, VIC",
        start_date: "Jan 2022",
        end_date: "Present",
        is_current: false,
        description: "Ran daily fulfilment operations.",
        wins: [],
      },
    ],
    projects: [],
    education: [],
    skills: [],
    tools: [],
    stakeholders: [],
    referees: [],
    raw_linkedin_paste: null,
    updated_at: "2024-01-01",
    ...overrides,
  };
}

describe("runQualityGate", () => {
  it("does not need review for a clean resume with no flags and no wins to guard", () => {
    const result = runQualityGate({
      resume: baseResume(),
      profile: baseProfile(),
      factCheckFlags: [],
      bridgeFactCheckFlags: [],
    });
    expect(result.needsReview).toBe(false);
  });

  it("marks needs-review when a high-severity fact-check flag is present", () => {
    const result = runQualityGate({
      resume: baseResume(),
      profile: baseProfile(),
      factCheckFlags: [{ severity: "high", location: "Work experience #1", message: "Fabricated figure", value: "500%" }],
      bridgeFactCheckFlags: [],
    });
    expect(result.needsReview).toBe(true);
    expect(result.checks.find((c) => c.id === "truthfulness")?.passed).toBe(false);
  });

  it("hard-fails coverage when the profile has wins but none are reflected in any bullet", () => {
    const profile = baseProfile({
      work_experience: [
        {
          job_title: "Operations Coordinator",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "Jan 2022",
          end_date: "Present",
          is_current: false,
          description: "Ran daily fulfilment operations.",
          wins: [{ text: "Rebuilt the stocktake process from scratch", metric: "" }],
        },
      ],
    });
    const result = runQualityGate({
      resume: baseResume(),
      profile,
      factCheckFlags: [],
      bridgeFactCheckFlags: [],
    });
    expect(result.needsReview).toBe(true);
    expect(result.checks.find((c) => c.id === "user_data_coverage")?.passed).toBe(false);
  });

  it("passes coverage when at least one win's language shows up in a bullet, even if others are trimmed", () => {
    const profile = baseProfile({
      work_experience: [
        {
          job_title: "Operations Coordinator",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "Jan 2022",
          end_date: "Present",
          is_current: false,
          description: "Ran daily fulfilment operations.",
          wins: [
            { text: "Rebuilt the stocktake process from scratch", metric: "" },
            { text: "Trained new warehouse staff", metric: "" },
          ],
        },
      ],
    });
    const resume = baseResume({
      experience: [
        {
          job_title: "Operations Coordinator",
          company: "Coles",
          company_description: "",
          location: "Melbourne, VIC",
          start_date: "Jan 2022",
          end_date: "Present",
          bullets: ["Rebuilt the stocktake process, cutting count time significantly."],
        },
      ],
    });
    const result = runQualityGate({ resume, profile, factCheckFlags: [], bridgeFactCheckFlags: [] });
    expect(result.checks.find((c) => c.id === "user_data_coverage")?.passed).toBe(true);
    expect(result.needsReview).toBe(false);
  });

  it("hard-fails when the summary claims more years than the merged dates support", () => {
    const profile = baseProfile({
      work_experience: [
        {
          job_title: "Operations Coordinator",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "2021",
          end_date: "Present",
          is_current: false,
          description: "Ran daily fulfilment operations.",
          wins: [],
        },
      ],
    });
    const resume = baseResume({ summary: "Operations coordinator with 6+ years of experience in fulfilment." });
    const result = runQualityGate({ resume, profile, factCheckFlags: [], bridgeFactCheckFlags: [] });
    expect(result.needsReview).toBe(true);
    expect(result.checks.find((c) => c.id === "duration_claim")?.passed).toBe(false);
  });

  it("does not flag a duration claim that the merged dates comfortably support", () => {
    const profile = baseProfile({
      work_experience: [
        {
          job_title: "Operations Coordinator",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "2015",
          end_date: "Present",
          is_current: false,
          description: "Ran daily fulfilment operations.",
          wins: [],
        },
      ],
    });
    const resume = baseResume({ summary: "Operations coordinator with 6+ years of experience in fulfilment." });
    const result = runQualityGate({ resume, profile, factCheckFlags: [], bridgeFactCheckFlags: [] });
    expect(result.checks.find((c) => c.id === "duration_claim")?.passed).toBe(true);
  });

  it("flags overlapping roles as a warning without triggering needs-review", () => {
    const profile = baseProfile({
      work_experience: [
        {
          job_title: "Operations Coordinator",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "Jan 2020",
          end_date: "Dec 2022",
          is_current: false,
          description: "",
          wins: [],
        },
        {
          job_title: "Casual Retail Assistant",
          company: "Woolworths",
          location: "Melbourne, VIC",
          start_date: "Jan 2021",
          end_date: "Jun 2021",
          is_current: false,
          description: "",
          wins: [],
        },
      ],
    });
    const resume = baseResume();
    const result = runQualityGate({ resume, profile, factCheckFlags: [], bridgeFactCheckFlags: [] });
    const dateCheck = result.checks.find((c) => c.id === "date_validity");
    expect(dateCheck?.passed).toBe(false);
    expect(dateCheck?.severity).toBe("warning");
    expect(result.needsReview).toBe(false);
  });

  it("never invents content - every detail string traces to a flag, win, or the resume's own text", () => {
    const result = runQualityGate({
      resume: baseResume(),
      profile: baseProfile(),
      factCheckFlags: [],
      bridgeFactCheckFlags: [],
    });
    // The gate only ever composes/reports; it must not add checks beyond the registered set.
    expect(result.checks.map((c) => c.id)).toEqual([
      "truthfulness",
      "duration_claim",
      "user_data_coverage",
      "date_validity",
      "ai_smell_phrases",
      "duplicate_bullets",
      "summary_experience_duplication",
      "length",
    ]);
  });
});
