import { describe, expect, it } from "vitest";
import { hasResumeContent, importedProfileToUserProfile, profileAdditionsFrom } from "./importedProfile";
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
