import { describe, expect, it } from "vitest";
import { hasResumeContent, importedProfileToUserProfile, parsedEmail, profileAdditionsFrom, skillsWithTools, uploadedResumeContent } from "./importedProfile";
import type { UserProfile } from "@/types";

function imported(fields: Record<string, unknown>): UserProfile {
  return importedProfileToUserProfile(fields, null, "user-1").profile;
}

const stored = {
  work_rights: "Australian citizen",
  phone: "",
  location: "Parramatta, NSW",
  linkedin_url: null,
  skills: ["Excel", "Reporting"],
  work_experience: [{ job_title: "Coordinator", company: "Acme", description: "Saved wording" }],
  education: [],
  projects: [],
  referees: [{ name: "Jo Bloggs" }],
} as unknown as UserProfile;

describe("importedProfileToUserProfile", () => {
  it("keeps long contact URLs intact through both import paths and uses saved links when absent", () => {
    const portfolio = `https://sam.dev/work?filter=${"x".repeat(600)}#projects`;
    const source = { portfolio_url: portfolio, github_url: "github.com/sam" };
    expect(imported(source)).toMatchObject(source);
    const fallback = { name: "Sam", phone: "", email: "", location: "", linkedin: "", work_rights: "", portfolio: "sam.dev", github: "github.com/saved" };
    expect(uploadedResumeContent(source, fallback).contact).toMatchObject({ portfolio, github: source.github_url });
    expect(uploadedResumeContent({}, fallback).contact).toMatchObject({ portfolio: fallback.portfolio, github: fallback.github });
    expect(importedProfileToUserProfile({}, { ...stored, portfolio_url: portfolio, github_url: source.github_url }, "user-1").profile).toMatchObject(source);
  });
  it("falls back to saved contact details only, never saved roles, skills or goals", () => {
    const { profile, fullName } = importedProfileToUserProfile(
      { fullName: " Sam Lee ", skills: ["Forklift"] },
      { ...stored, target_role: "Data Analyst" },
      "user-1"
    );

    expect(fullName).toBe("Sam Lee");
    expect(profile.location).toBe("Parramatta, NSW");
    expect(profile.skills).toEqual(["Forklift"]);
    expect(profile.work_experience).toEqual([]);
    expect(profile.target_role).toBeNull();
  });

  it("copes with a missing or malformed upload", () => {
    expect(importedProfileToUserProfile(null, null, "user-1").profile.skills).toEqual([]);
    expect(importedProfileToUserProfile("nope", null, "user-1").profile.work_experience).toEqual([]);
  });
});

describe("hasResumeContent", () => {
  it("accepts any of roles, education, skills or projects, and refuses contact details alone", () => {
    expect(hasResumeContent(imported({ fullName: "Sam", phone: "0400" }))).toBe(false);
    expect(hasResumeContent(imported({ skills: ["Forklift"] }))).toBe(true);
    expect(hasResumeContent(imported({ projects: [{ title: "Shed build" }] }))).toBe(true);
  });
});

describe("profileAdditionsFrom", () => {
  it("adds only what's new, after the saved entries, and keeps saved wording", () => {
    const additions = profileAdditionsFrom(
      imported({
        phone: "0400 111 222",
        location: "Penrith, NSW",
        skills: ["excel", "Forklift"],
        work_experience: [
          { job_title: "coordinator", company: " ACME ", description: "File wording" },
          { job_title: "Storeperson", company: "Depot Co", description: "Picked stock" },
        ],
        referees: [{ name: "jo bloggs" }],
      }),
      stored
    );

    expect(additions?.phone).toBe("0400 111 222");
    // Saved contact details are never replaced.
    expect(additions).not.toHaveProperty("location");
    expect(additions?.skills).toEqual(["Excel", "Reporting", "Forklift"]);
    expect(additions?.work_experience?.map((e) => [e.company, e.description])).toEqual([
      ["Acme", "Saved wording"],
      ["Depot Co", "Picked stock"],
    ]);
    // Every referee was already saved, so referees aren't touched.
    expect(additions).not.toHaveProperty("referees");
  });

  it("fills an empty profile with everything from the file", () => {
    const additions = profileAdditionsFrom(imported({ skills: ["Forklift"], education: [{ degree: "Cert III" }] }), null);

    expect(additions?.skills).toEqual(["Forklift"]);
    expect(additions?.education?.map((e) => e.degree)).toEqual(["Cert III"]);
  });

  it("is null when the file adds nothing", () => {
    expect(profileAdditionsFrom(imported({ skills: ["EXCEL"], location: "Somewhere" }), stored)).toBeNull();
  });

  it("never drops saved entries, even past the list cap", () => {
    const many = Array.from({ length: 60 }, (_, i) => `Skill ${i}`);
    const additions = profileAdditionsFrom(imported({ skills: ["New skill"] }), { ...stored, skills: many });

    expect(additions?.skills?.slice(0, 60)).toEqual(many);
  });
});

describe("uploadedResumeContent", () => {
  const fallback = { name: "Account Name", email: "me@example.com", phone: "0400 000 000", location: "Parramatta, NSW", linkedin: "", work_rights: "Australian citizen" };

  it("keeps every line, in the file's order, word for word", () => {
    const content = uploadedResumeContent(
      {
        fullName: "Sam Lee",
        email: "sam@example.com",
        summary: "Hard working storeperson ",
        skills: ["Forklift"],
        tools: ["Systems: SAP, Excel"],
        work_experience: [
          { job_title: "Lead", company: "Newer Co", start_date: "2022", end_date: "", is_current: true, bullets: ["b1", "b2", "b3", "b4", "b5", "b6", "b7"] },
          { job_title: "Hand", company: "Older Co", start_date: "2018", end_date: "2021", bullets: ["  teh first one ", "", "second"] },
        ],
      },
      fallback
    );

    expect(content.contact).toMatchObject({ name: "Sam Lee", email: "sam@example.com", location: "Parramatta, NSW", work_rights: "Australian citizen" });
    expect(content.summary).toBe("Hard working storeperson");
    expect(content.tools).toEqual(["Systems: SAP, Excel"]);
    expect(content.experience.map((role) => role.company)).toEqual(["Newer Co", "Older Co"]);
    expect(content.experience[0].bullets).toHaveLength(7);
    expect(content.experience[0].end_date).toBe("Present");
    expect(content.experience[1].bullets).toEqual(["teh first one", "second"]);
  });

  it("falls back to a role's description lines when it has no bullets", () => {
    const content = uploadedResumeContent(
      { work_experience: [{ job_title: "Hand", company: "Co", description: "Line one\nLine two" }] },
      fallback
    );

    expect(content.experience[0].bullets).toEqual(["Line one", "Line two"]);
  });

  it("maps projects and education, dropping untitled projects", () => {
    const content = uploadedResumeContent(
      {
        projects: [{ title: "Food drive", context: "Volunteer", timeframe: "2023", bullets: ["Ran it"] }, { title: " ", bullets: ["x"] }],
        education: [{ degree: "First Aid Certificate", institution: "St John", start_date: "", end_date: "2024" }],
      },
      fallback
    );

    expect(content.projects).toEqual([{ title: "Food drive", context: "Volunteer", year: "2023", bullets: ["Ran it"] }]);
    expect(content.education).toEqual([{ degree: "First Aid Certificate", institution: "St John", year: "2024", notes: "" }]);
  });
});

describe("skillsWithTools", () => {
  it("adds each tool name from category lines once, after the skills", () => {
    expect(skillsWithTools(["Excel", "Reporting"], ["Data: SQL, python; excel", "Xero | MYOB"])).toEqual([
      "Excel",
      "Reporting",
      "SQL",
      "python",
      "Xero",
      "MYOB",
    ]);
  });

  it("never splits inside brackets, and keeps a line with no list whole", () => {
    expect(skillsWithTools([], ["Microsoft Office (Word, Excel), Xero", "Salesforce: advanced"])).toEqual([
      "Microsoft Office (Word, Excel)",
      "Xero",
      "Salesforce: advanced",
    ]);
  });
});

describe("parsedEmail", () => {
  it("keeps a single address and rejects a copied contact line", () => {
    expect(parsedEmail(" sam@example.com ")).toBe("sam@example.com");
    expect(parsedEmail("sam@example.com | 0400 000 000")).toBe("");
    expect(parsedEmail("sam at example dot com")).toBe("");
  });
});
