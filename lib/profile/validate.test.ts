import { describe, expect, it } from "vitest";
import { groupIssuesByField, validateProfile, type ValidateProfileInput } from "./validate";
import type { WorkExperienceEntry } from "@/types";

function role(overrides: Partial<WorkExperienceEntry> = {}): WorkExperienceEntry {
  return {
    job_title: "Business Analyst",
    company: "Woolworths Group",
    location: "Sydney, NSW",
    start_date: "Jan 2020",
    end_date: "Dec 2022",
    is_current: false,
    description: "Led process improvement initiatives.",
    wins: [],
    ...overrides,
  };
}

function baseProfile(overrides: Partial<ValidateProfileInput> = {}): ValidateProfileInput {
  return {
    fullName: "Jamie Citizen",
    work_rights: "Australian citizen",
    phone: "0400 000 000",
    location: "Parramatta, NSW",
    linkedin_url: "https://linkedin.com/in/jamiecitizen",
    raw_linkedin_paste: null,
    skills: ["SQL", "Excel", "Stakeholder Management"],
    work_experience: [role()],
    education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
    referees: [{ name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" }],
    ...overrides,
  };
}

describe("validateProfile - dates", () => {
  it("returns no issues for a clean, fully filled-out profile", () => {
    expect(validateProfile(baseProfile())).toEqual([]);
  });

  it("flags an end date before the start date as an error", () => {
    const issues = validateProfile(baseProfile({ work_experience: [role({ start_date: "2022", end_date: "2020" })] }));
    const issue = issues.find((i) => i.id === "date-end-before-start-0");
    expect(issue?.severity).toBe("error");
    expect(issue?.field).toBe("work_experience.0.end_date");
  });

  it("flags a role marked current that also carries an end date", () => {
    const issues = validateProfile(
      baseProfile({ work_experience: [role({ is_current: true, end_date: "Dec 2022" })] })
    );
    const issue = issues.find((i) => i.id === "date-current-conflict-0");
    expect(issue?.severity).toBe("error");
  });

  it("does not flag a current role with no end date", () => {
    const issues = validateProfile(baseProfile({ work_experience: [role({ is_current: true, end_date: "" })] }));
    expect(issues.some((i) => i.id.startsWith("date-"))).toBe(false);
  });

  it("flags a start date far in the future", () => {
    const futureYear = new Date().getFullYear() + 5;
    const issues = validateProfile(baseProfile({ work_experience: [role({ start_date: `${futureYear}` })] }));
    expect(issues.some((i) => i.id === "date-future-start-0")).toBe(true);
  });

  it("stays quiet on a legacy 'Present' end_date even when is_current wasn't migrated", () => {
    const issues = validateProfile(baseProfile({ work_experience: [role({ is_current: false, end_date: "Present" })] }));
    expect(issues.some((i) => i.id.startsWith("date-"))).toBe(false);
  });

  it("does not treat an unparseable date as a contradiction", () => {
    const issues = validateProfile(baseProfile({ work_experience: [role({ start_date: "sometime last year" })] }));
    expect(issues.some((i) => i.id === "date-unparseable-start-0")).toBe(true);
    // Only the "can't parse" error fires - it shouldn't also claim end-before-start etc.
    expect(issues.filter((i) => i.field === "work_experience.0.end_date")).toEqual([]);
  });
});

describe("validateProfile - overlaps", () => {
  it("flags unexplained overlapping roles as a soft hint, not an error", () => {
    const issues = validateProfile(
      baseProfile({
        work_experience: [
          role({ start_date: "Jan 2020", end_date: "Dec 2022" }),
          role({ job_title: "Casual Retail Assistant", company: "Coles", start_date: "Jan 2021", end_date: "Jun 2021" }),
        ],
      })
    );
    const overlap = issues.find((i) => i.id.startsWith("overlap-"));
    expect(overlap?.severity).toBe("hint");
  });

  it("does not flag back-to-back roles with no overlap", () => {
    const issues = validateProfile(
      baseProfile({
        work_experience: [
          role({ start_date: "Jan 2018", end_date: "Dec 2019" }),
          role({ job_title: "Data Analyst", start_date: "Jan 2020", end_date: "Dec 2022" }),
        ],
      })
    );
    expect(issues.some((i) => i.id.startsWith("overlap-"))).toBe(false);
  });
});

describe("validateProfile - formats", () => {
  it("flags an invalid LinkedIn link as an error", () => {
    const issues = validateProfile(baseProfile({ linkedin_url: "not a link" }));
    const issue = issues.find((i) => i.id === "format-linkedin");
    expect(issue?.severity).toBe("error");
  });

  it("accepts a LinkedIn link without an explicit protocol", () => {
    const issues = validateProfile(baseProfile({ linkedin_url: "linkedin.com/in/jamiecitizen" }));
    expect(issues.some((i) => i.id === "format-linkedin")).toBe(false);
  });

  it("flags a malformed referee email as an error", () => {
    const issues = validateProfile(
      baseProfile({ referees: [{ name: "Alex", title: "", organisation: "", phone: "", email: "not-an-email" }] })
    );
    const issue = issues.find((i) => i.id === "format-referee-email-0");
    expect(issue?.severity).toBe("error");
  });

  it("flags an implausible phone number as a soft hint, not an error", () => {
    const issues = validateProfile(baseProfile({ phone: "123" }));
    const issue = issues.find((i) => i.id === "format-phone");
    expect(issue?.severity).toBe("hint");
  });
});

describe("validateProfile - completeness", () => {
  it("surfaces a missing MVP field as a hint tied to that field", () => {
    const issues = validateProfile(baseProfile({ skills: ["SQL"] }));
    const issue = issues.find((i) => i.id === "mvp-skills");
    expect(issue?.severity).toBe("hint");
    expect(issue?.field).toBe("skills");
  });

  it("never suggests adding impressive-sounding content, only presence", () => {
    const issues = validateProfile(baseProfile({ skills: [] }));
    for (const issue of issues) {
      expect(issue.message.toLowerCase()).not.toMatch(/impress|stronger|stand out|number/);
    }
  });
});

describe("validateProfile - empty but started", () => {
  it("hints when a role has a title but no dates or description", () => {
    const issues = validateProfile(
      baseProfile({ work_experience: [role({ start_date: "", end_date: "", description: "" })] })
    );
    const issue = issues.find((i) => i.id === "empty-started-experience-0");
    expect(issue?.severity).toBe("hint");
  });

  it("hints when a referee has a name but no way to reach them", () => {
    const issues = validateProfile(
      baseProfile({ referees: [{ name: "Alex Manager", title: "", organisation: "", phone: "", email: "" }] })
    );
    expect(issues.some((i) => i.id === "empty-started-referee-0")).toBe(true);
  });

  it("hints when only one of degree/institution is filled in", () => {
    const issues = validateProfile(baseProfile({ education: [{ degree: "Bachelor of Commerce", institution: "", year: "", notes: "" }] }));
    expect(issues.some((i) => i.id === "empty-started-education-0")).toBe(true);
  });
});

describe("groupIssuesByField", () => {
  it("groups multiple issues on the same field together", () => {
    const issues = validateProfile(
      baseProfile({ work_experience: [role({ is_current: true, end_date: "Dec 2022", start_date: "not a date" })] })
    );
    const grouped = groupIssuesByField(issues);
    expect(grouped.get("work_experience.0.end_date")?.length).toBe(1);
    expect(grouped.get("work_experience.0.start_date")?.length).toBe(1);
  });
});
