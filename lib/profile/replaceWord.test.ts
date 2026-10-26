import { describe, expect, it } from "vitest";
import { profileHasWord, replaceWordInProfile, type WordFixableProfile } from "./replaceWord";

const PROFILE: WordFixableProfile = {
  work_experience: [
    {
      job_title: "Analytics Enginer",
      company: "Acme",
      location: "Sydney",
      start_date: "2022",
      end_date: "",
      is_current: true,
      description: "Built dbt models as an Enginer on the data team.",
      wins: [{ text: "Cut report time as lead Enginer", metric: "30%" }],
    },
  ],
  projects: [],
  education: [],
  skills: ["SQL"],
  tools: ["dbt"],
};

describe("replaceWordInProfile", () => {
  it("fixes the word everywhere it appears as a whole word, and counts the changes", () => {
    const { profile, replaced } = replaceWordInProfile(PROFILE, "Enginer", "Engineer");
    expect(replaced).toBe(3);
    expect(profile.work_experience[0].job_title).toBe("Analytics Engineer");
    expect(profile.work_experience[0].description).toBe("Built dbt models as an Engineer on the data team.");
    expect(profile.work_experience[0].wins?.[0]).toEqual({ text: "Cut report time as lead Engineer", metric: "30%", what: undefined, outcome: undefined });
  });

  it("leaves words that only contain it alone", () => {
    const { replaced } = replaceWordInProfile({ ...PROFILE, skills: ["Enginering"] }, "Enginer", "Engineer");
    expect(replaced).toBe(3);
  });
});

describe("profileHasWord", () => {
  it("finds a whole word in the profile, case-sensitively", () => {
    expect(profileHasWord(PROFILE, "Enginer")).toBe(true);
    expect(profileHasWord(PROFILE, "enginer")).toBe(false);
    expect(profileHasWord(null, "Enginer")).toBe(false);
  });
});
