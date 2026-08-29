import { describe, it, expect } from "vitest";
import { checkResumeStructure, MAX_STRUCTURE_POINTS } from "./structureChecks";
import type { ResumeContent } from "@/types";

function createSampleResume(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    contact: {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "+61 400 123 456",
      location: "Sydney, NSW",
      linkedin: "linkedin.com/in/janedoe",
      work_rights: "Australian Citizen",
    },
    target_titles: ["Operations Lead"],
    summary: "Experienced operations leader with 6+ years driving process improvements.",
    skills: ["Process Optimization", "Team Leadership", "Stakeholder Management", "Agile"],
    tools: ["Operations: Jira, Confluence, Excel"],
    experience: [
      {
        job_title: "Operations Manager",
        company: "Acme Logistics",
        company_description: "National freight provider",
        location: "Sydney, NSW",
        start_date: "Jan 2022",
        end_date: "Present",
        bullets: [
          "Led a team of 15 operations coordinators to deliver 99.4% on-time delivery across NSW.",
          "Streamlined inventory tracking workflows, reducing dispatch turnaround by 35%.",
        ],
      },
    ],
    projects: [],
    education: [
      {
        degree: "Bachelor of Business",
        institution: "University of Sydney",
        year: "2018",
        notes: "",
      },
    ],
    referees: [
      {
        name: "John Smith",
        title: "Director",
        organisation: "Acme Logistics",
        phone: "+61 400 987 654",
        email: "john.smith@acme.com",
      },
    ],
    ...overrides,
  };
}

describe("checkResumeStructure", () => {
  it("gives full score for complete resume structure", () => {
    const resume = createSampleResume();
    const result = checkResumeStructure(resume);

    expect(result.maxPoints).toBe(MAX_STRUCTURE_POINTS);
    expect(result.score).toBe(MAX_STRUCTURE_POINTS);
    expect(result.findings).toHaveLength(0);
  });

  it("penalizes missing candidate name and email as hard fails", () => {
    const resume = createSampleResume({
      contact: {
        name: "",
        email: "",
        phone: "+61 400 123 456",
        location: "Sydney, NSW",
        linkedin: "",
        work_rights: "",
      },
    });
    const result = checkResumeStructure(resume);

    expect(result.score).toBeLessThan(MAX_STRUCTURE_POINTS);
    const hardFails = result.findings.filter((f) => f.severity === "hard_fail");
    expect(hardFails.some((f) => f.id === "struct-missing-name")).toBe(true);
    expect(hardFails.some((f) => f.id === "struct-missing-email")).toBe(true);
  });

  it("flags missing work experience as a hard fail", () => {
    const resume = createSampleResume({ experience: [] });
    const result = checkResumeStructure(resume);

    expect(result.findings.some((f) => f.id === "struct-missing-experience")).toBe(true);
  });

  it("flags incomplete role entries with missing job title or company", () => {
    const resume = createSampleResume({
      experience: [
        {
          job_title: "",
          company: "Acme Logistics",
          company_description: "",
          location: "Sydney",
          start_date: "2022",
          end_date: "Present",
          bullets: ["Managed warehouse operations."],
        },
      ],
    });
    const result = checkResumeStructure(resume);

    expect(result.findings.some((f) => f.id.includes("struct-role-0-incomplete"))).toBe(true);
  });
});
