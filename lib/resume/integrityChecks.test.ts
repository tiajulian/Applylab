import { describe, it, expect } from "vitest";
import { checkResumeIntegrity } from "./integrityChecks";
import type { ResumeContent, ResumeExperienceEntry } from "@/types";

const NOW = 2026 * 12 + 8;

const role = (o: Partial<ResumeExperienceEntry> = {}): ResumeExperienceEntry => ({
  job_title: "Analyst",
  company: "Acme Bank",
  company_description: "",
  location: "",
  start_date: "January 2020",
  end_date: "December 2022",
  bullets: ["Reduced fraud losses by 12% across the portfolio."],
  ...o,
});

const resume = (o: Partial<ResumeContent> = {}): ResumeContent => ({
  contact: { name: "A", phone: "0400", email: "a@b.co", location: "Sydney, NSW", linkedin: "linkedin.com/in/a", work_rights: "" },
  target_titles: [],
  summary: "Skilled analyst.",
  skills: [],
  tools: [],
  experience: [role()],
  projects: [],
  education: [],
  referees: [],
  ...o,
});

const ids = (r: ResumeContent) => checkResumeIntegrity(r, NOW).map((f) => f.id);

describe("checkResumeIntegrity", () => {
  it("returns nothing for a clean resume", () => {
    expect(ids(resume())).toEqual([]);
  });

  it("flags placeholder and cut-off employers but not a state suffix", () => {
    expect(ids(resume({ experience: [role({ company: "abc - sydney" })] }))).toContain("integrity-company-placeholder-0");
    expect(ids(resume({ experience: [role({ company: "Acme - s" })] }))).toContain("integrity-company-cutoff-0");
    expect(ids(resume({ experience: [role({ company: "Acme Bank - SA" })] }))).toEqual([]);
    expect(ids(resume({ experience: [role({ company: "" })] }))).toContain("integrity-company-missing-0");
  });

  it("flags lowercase titles and one-letter title typos, not valid variants", () => {
    const found = ids(resume({ experience: [role({ job_title: "analytics enginer" })] }));
    expect(found).toContain("integrity-title-case-0");
    expect(found).toContain("integrity-title-typo-0");
    expect(ids(resume({ experience: [role({ job_title: "Analytics Engineer" })] }))).toEqual([]);
    expect(ids(resume({ experience: [role({ job_title: "Senior Adviser" })] }))).toEqual([]);
    expect(ids(resume({ experience: [role({ job_title: "Analysts Lead" })] }))).toEqual([]);
  });

  it("flags missing / dash-only dates", () => {
    expect(ids(resume({ experience: [role({ start_date: "", end_date: "-" })] }))).toContain("integrity-dates-missing-0");
    expect(ids(resume({ experience: [role({ end_date: "" })] }))).toContain("integrity-dates-missing-0");
  });

  it("flags end before start and future starts", () => {
    expect(ids(resume({ experience: [role({ start_date: "2022", end_date: "2020" })] }))).toContain("integrity-dates-order-0");
    expect(ids(resume({ experience: [role({ start_date: "2030", end_date: "Present" })] }))).toContain("integrity-dates-future-0");
  });

  it("flags a duplicate role (spelled two ways) on the entry with fewer bullets, plus the spelling", () => {
    const found = checkResumeIntegrity(
      resume({
        experience: [
          role({ company: "Commbank", job_title: "Financial Crime Analyst", bullets: ["Led 3 reviews."] }),
          role({ company: "Combank", job_title: "Financial Crime Analyst", bullets: [], start_date: "2018", end_date: "2019" }),
        ],
      }),
      NOW
    );
    const dup = found.find((f) => f.id === "integrity-duplicate-role-1");
    expect(dup?.target).toEqual({ kind: "experienceHeader", index: 1, field: "role" });
    expect(found.map((f) => f.id)).toContain("integrity-company-spelling-1");
  });

  it("does not treat a case-only difference as inconsistent spelling", () => {
    const found = ids(resume({ experience: [role({ company: "CommBank" }), role({ company: "Commbank", job_title: "Teller", start_date: "2015", end_date: "2019" })] }));
    expect(found).not.toContain("integrity-company-spelling-1");
  });

  it("flags roles not in reverse-chronological order", () => {
    const found = ids(resume({ experience: [role({ start_date: "2015", end_date: "2016" }), role({ job_title: "Lead", start_date: "2019", end_date: "2020" })] }));
    expect(found).toContain("integrity-chronology");
  });

  it("flags three simultaneous current roles, and tense on a current role", () => {
    const cur = (title: string, start: string) =>
      role({ job_title: title, company: `${title} Co`, start_date: start, end_date: "Current", bullets: ["Extracted 5 datasets.", "Engineered 2 pipelines."] });
    const found = ids(resume({ experience: [cur("Engineer", "2023"), cur("Analyst", "2021"), cur("Barista", "February 2009")] }));
    expect(found).toContain("integrity-many-current");
    expect(found).toContain("integrity-tense-0");
  });

  it("flags empty roles, empty projects and untitled projects", () => {
    expect(ids(resume({ experience: [role({ bullets: [] })] }))).toContain("integrity-no-bullets-0");
    const p = ids(resume({ projects: [{ title: "", context: "", year: "", bullets: [] }, { title: "", context: "", year: "", bullets: ["x"] }] }));
    expect(p).toContain("integrity-project-empty-0");
    expect(p).toContain("integrity-project-untitled-1");
  });

  it("flags overclaiming, missing LinkedIn, partial location and zero metrics", () => {
    const found = ids(
      resume({
        summary: "Expert in AML monitoring.",
        contact: { name: "A", phone: "1", email: "a@b.co", location: "Kogarah", linkedin: "", work_rights: "" },
        experience: [role({ bullets: ["Did a thing.", "Did another.", "Did a third."] })],
      })
    );
    expect(found).toEqual(expect.arrayContaining(["integrity-overclaim", "integrity-no-linkedin", "integrity-location-partial", "integrity-no-metrics"]));
    expect(ids(resume({ contact: { ...resume().contact, location: "Perth WA" } }))).not.toContain("integrity-location-partial");
  });
});
