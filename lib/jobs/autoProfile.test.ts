import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAutoProfile, cleanTitle, deriveJobProfile, normalizeAuLocation, type AutoProfileSources } from "@/lib/jobs/autoProfile";
import { fakeSupabase } from "@/lib/jobs/testing/fakeSupabase";
import type { WorkExperienceEntry } from "@/types";

function role(overrides: Partial<WorkExperienceEntry>): WorkExperienceEntry {
  return {
    job_title: "",
    company: "",
    location: "",
    start_date: "",
    end_date: "",
    is_current: false,
    description: "",
    wins: [],
    ...overrides,
  };
}

const empty: AutoProfileSources = { skills: null, location: null, workExperience: null, resumeTitles: [], applicationTitles: [] };

describe("normalizeAuLocation", () => {
  it.each([
    ["Sydney NSW 2000", "Sydney"],
    ["North Sydney", "Sydney"],
    ["Melbourne, VIC", "Melbourne"],
    ["Parramatta, NSW 2150", "New South Wales"],
    ["Wagga Wagga", null],
    ["Kogarah", null],
    ["Victoria Park, WA", "Western Australia"],
    ["Fremantle WA", "Western Australia"],
    ["queensland", "Queensland"],
    ["  ", null],
    [null, null],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeAuLocation(raw)).toBe(expected);
  });
});

describe("cleanTitle", () => {
  it.each([
    ["Customer Service Officer", "Customer Service Officer"],
    ["Data Analyst | Dayforce Jobs", "Data Analyst"],
    ["Manual application | Dayforce Jobs", null],
    ["General resume", null],
    ["Resume", null],
    ["My CV", null],
    ["Untitled", null],
    ["  ", null],
  ])("%s -> %s", (raw, expected) => expect(cleanTitle(raw)).toBe(expected));
});

describe("deriveJobProfile location", () => {
  const sources = (location: string, places: object[]) =>
    fakeSupabase({
      user_profiles: [{ data: { skills: ["SQL"], location, work_experience: [] } }],
      resumes: [{ data: [] }],
      applications: [{ data: [] }],
      au_places: [{ data: places }],
    });
  const derive = (fake: ReturnType<typeof fakeSupabase>) => deriveJobProfile(fake.client as unknown as SupabaseClient, "u1");

  it("keeps a known suburb as the location (the range then covers its metro area)", async () => {
    const fake = sources("kogarah 2217", [{ name: "Kogarah", name_key: "kogarah", state_code: "NSW", lat: -33.97, lng: 151.14 }]);
    expect((await derive(fake))?.locations).toEqual(["Kogarah NSW"]); // postcode 2217 -> NSW
    expect(fake.calls.find((c) => c.method === "in")?.args).toEqual(["name_key", ["kogarah"]]);
  });

  it("falls back to a city or state named in the text", async () => {
    expect((await derive(sources("Greater Perth WA", [])))?.locations).toEqual(["Perth"]);
  });

  it("searches all of Australia for a place it can't resolve", async () => {
    expect((await derive(sources("Nowhereville", [])))?.locations).toEqual([]);
  });
});

describe("buildAutoProfile", () => {
  it("returns null when there is nothing to match on", () => {
    expect(buildAutoProfile(empty)).toBeNull();
    expect(buildAutoProfile({ ...empty, location: "Perth" })).toBeNull();
  });

  it("targets resume and application titles first, then the most recent role", () => {
    const profile = buildAutoProfile({
      ...empty,
      resumeTitles: ["General resume", "Frontend Developer", null, "frontend developer"],
      applicationTitles: ["React Engineer | Seek", "[Job Title]", "Manual application | Dayforce Jobs"],
      workExperience: [
        role({ job_title: "Junior Dev", start_date: "Jan 2018", end_date: "Dec 2019" }),
        role({ job_title: "Web Developer", start_date: "Jan 2020", is_current: true }),
      ],
    })!;
    expect(profile.targetTitles).toEqual(["Frontend Developer", "React Engineer", "Web Developer"]);
  });

  it("caps titles at 5 and skills at 30", () => {
    const profile = buildAutoProfile({
      ...empty,
      resumeTitles: Array.from({ length: 8 }, (_, i) => `Role ${i}`),
      skills: Array.from({ length: 40 }, (_, i) => `Skill ${i}`),
    })!;
    expect(profile.targetTitles).toHaveLength(5);
    expect(profile.skills).toHaveLength(30);
  });

  it("works from skills alone and fills location and background", () => {
    const profile = buildAutoProfile({
      ...empty,
      skills: ["SQL", "sql", "Excel"],
      location: "Brisbane",
      workExperience: [role({ job_title: "Analyst", company: "Acme", description: "Built dashboards.", is_current: true })],
    })!;
    expect(profile).toMatchObject({
      targetTitles: ["Analyst"],
      skills: ["SQL", "Excel"],
      locations: ["Brisbane"],
      resumeText: "Analyst at Acme. Built dashboards.",
      minSalary: null,
      contractTypes: [],
    });
  });
});
