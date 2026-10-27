import { describe, expect, it } from "vitest";
import {
  EMPTY_PROFILE_ENTRY,
  addEntriesToResume,
  educationFromProfile,
  experienceFromProfile,
  profileEntryKey,
  projectFromProfile,
  resumeEntryKeys,
  toProfileLibrary,
} from "./addEntries";
import type { ResumeContent, UserProfile } from "@/types";

function resumeWith(partial: Partial<ResumeContent>): ResumeContent {
  return {
    contact: { name: "", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
    target_titles: [],
    summary: "",
    skills: [],
    tools: [],
    experience: [],
    projects: [],
    education: [],
    referees: [],
    ...partial,
  };
}

const role = (job_title: string, start_date: string, end_date: string) => ({
  job_title,
  company: "Co",
  company_description: "",
  location: "",
  start_date,
  end_date,
  bullets: ["x"],
});

const newRole = (job_title: string, start_date: string, end_date: string, is_current = false) => ({
  ...EMPTY_PROFILE_ENTRY.experience(),
  job_title,
  company: "New Co",
  start_date,
  end_date,
  is_current,
});

describe("experienceFromProfile", () => {
  it("uses the candidate's own wins as bullets and writes the role the way generation does", () => {
    const entry = { ...newRole("barista", "March 2020", "", true), wins: [{ text: "Trained 4 staff", metric: "" }] };
    expect(experienceFromProfile(entry)).toMatchObject({ job_title: "Barista", end_date: "Current", bullets: ["Trained 4 staff"] });
  });

  it("falls back to the role's own notes, and never invents a bullet", () => {
    expect(experienceFromProfile({ ...newRole("Barista", "", ""), description: "• Made coffee\n- Opened the store" }).bullets).toEqual([
      "Made coffee",
      "Opened the store",
    ]);
    expect(experienceFromProfile(newRole("Barista", "", "")).bullets).toEqual([]);
  });
});

describe("projectFromProfile / educationFromProfile", () => {
  it("adds the outcome with its metric and the link as bullets", () => {
    const project = { ...EMPTY_PROFILE_ENTRY.projects(), title: "App", outcome: "Shipped", outcome_metric: "500 users", link: "x.dev" };
    expect(projectFromProfile(project).bullets).toEqual(["Shipped (500 users)", "Project link: x.dev"]);
  });

  it("shows a qualification still in progress as a range to Current", () => {
    const edu = { ...EMPTY_PROFILE_ENTRY.education(), degree: "BCom", start_date: "2024", is_current: true };
    expect(educationFromProfile(edu).year).toBe("2024 - Current");
    expect(educationFromProfile({ ...edu, is_current: false, end_date: "2026" }).year).toBe("2024 - 2026");
  });
});

describe("profileEntryKey / resumeEntryKeys", () => {
  it("matches a profile role and its resume copy regardless of case and spacing", () => {
    const resume = resumeWith({ experience: [{ ...role("Data  Analyst", "", ""), company: "ACME" }] });
    expect(resumeEntryKeys(resume, "experience").has(profileEntryKey("work_experience", { job_title: "data analyst", company: "Acme " }))).toBe(true);
  });
});

describe("addEntriesToResume", () => {
  const resume = resumeWith({
    experience: [role("Current", "Jan 2023", "Present"), role("Middle", "2020", "2022"), role("Oldest", "2015", "2017")],
  });

  it("places a new role by date, newest first, and reports where it went", () => {
    const { resume: next, firstIndex } = addEntriesToResume(resume, "experience", [newRole("Gap Year Job", "2018", "2019")]);
    expect(next.experience.map((e) => e.job_title)).toEqual(["Current", "Middle", "Gap Year Job", "Oldest"]);
    expect(firstIndex).toBe(2);
  });

  it("puts a current role first and an undated one first too", () => {
    expect(addEntriesToResume(resume, "experience", [newRole("Now", "2025", "", true)]).resume.experience[0].job_title).toBe("Now");
    expect(addEntriesToResume(resume, "experience", [newRole("Undated", "", "")]).firstIndex).toBe(0);
  });

  it("adds several at once and returns the topmost one's index", () => {
    const { resume: next, firstIndex } = addEntriesToResume(resume, "experience", [newRole("A", "2016", "2016"), newRole("B", "2021", "2023")]);
    expect(next.experience.map((e) => e.job_title)).toEqual(["Current", "B", "Middle", "Oldest", "A"]);
    expect(firstIndex).toBe(1);
  });

  it("sorts qualifications by their later year and appends referees", () => {
    const withEdu = resumeWith({ education: [{ degree: "MBA", institution: "", year: "2022", notes: "" }] });
    const study = { ...EMPTY_PROFILE_ENTRY.education(), degree: "Cert IV", start_date: "2024", is_current: true };
    expect(addEntriesToResume(withEdu, "education", [study]).firstIndex).toBe(0);

    const withRef = resumeWith({ referees: [{ name: "A", title: "", organisation: "", phone: "", email: "" }] });
    const { resume: next, firstIndex } = addEntriesToResume(withRef, "referees", [{ ...EMPTY_PROFILE_ENTRY.referees(), name: "B" }]);
    expect(next.referees.map((r) => r.name)).toEqual(["A", "B"]);
    expect(firstIndex).toBe(1);
  });
});

describe("toProfileLibrary", () => {
  it("fills missing fields and drops nulls from older stored rows", () => {
    const row = {
      work_experience: [{ job_title: "Barista", company: null, start_date: "2020", end_date: "2021" }],
      referees: [{ name: "Sam" }],
    } as unknown as Partial<UserProfile>;
    const library = toProfileLibrary(row);
    expect(library.work_experience[0]).toMatchObject({ job_title: "Barista", company: "", is_current: false, wins: [] });
    expect(library.referees[0]).toEqual({ name: "Sam", title: "", organisation: "", phone: "", email: "" });
    expect(library.projects).toEqual([]);
    expect(toProfileLibrary(null).education).toEqual([]);
  });
});
