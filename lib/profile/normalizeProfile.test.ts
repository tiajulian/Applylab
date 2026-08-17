import { describe, expect, it } from "vitest";
import { normalizeProfile } from "./normalizeProfile";
import type { EducationEntry, UserProfile, WorkExperienceEntry } from "@/types";

function role(overrides: Partial<WorkExperienceEntry> = {}): WorkExperienceEntry {
  return {
    job_title: "Analyst",
    company: "Co",
    location: "",
    start_date: "",
    end_date: "",
    is_current: false,
    description: "",
    wins: [],
    ...overrides,
  };
}

function education(overrides: Partial<EducationEntry> = {}): EducationEntry {
  return {
    degree: "BCom",
    institution: "University",
    start_date: "",
    end_date: "",
    is_current: false,
    notes: "",
    ...overrides,
  };
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "p1",
    user_id: "u1",
    work_rights: null,
    phone: null,
    location: null,
    linkedin_url: null,
    work_experience: [],
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

describe("normalizeProfile", () => {
  it("returns nulls/empty arrays for a null profile", () => {
    const result = normalizeProfile(null);
    expect(result).toEqual({ workExperience: [], education: [], normalizedProfile: null });
  });

  it("sorts work_experience most-recent-first", () => {
    const result = normalizeProfile(
      profile({
        work_experience: [
          role({ job_title: "Older", start_date: "Jan 2018", end_date: "Dec 2019" }),
          role({ job_title: "Newer", start_date: "Jan 2022", end_date: "Dec 2023" }),
        ],
      })
    );
    expect(result.workExperience.map((r) => r.job_title)).toEqual(["Newer", "Older"]);
    expect(result.normalizedProfile?.work_experience.map((r) => r.job_title)).toEqual(["Newer", "Older"]);
  });

  it("does not reorder education - resume generation and fixes match it back to the profile by position", () => {
    const result = normalizeProfile(
      profile({
        education: [
          education({ degree: "Older", start_date: "", end_date: "2015" }),
          education({ degree: "Newer", start_date: "", end_date: "2023" }),
        ],
      })
    );
    expect(result.education.map((e) => e.degree)).toEqual(["Older", "Newer"]);
  });

  it("migrates legacy shapes on both arrays", () => {
    const result = normalizeProfile(
      profile({
        work_experience: [{ job_title: "Analyst", company: "Co", location: "", start_date: "2020", end_date: "Present", description: "" } as never],
        education: [{ degree: "BCom", institution: "University", year: "2018" } as never],
      })
    );
    expect(result.workExperience[0].is_current).toBe(true);
    expect(result.education[0].end_date).toBe("2018");
  });
});
