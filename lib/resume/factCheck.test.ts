import { describe, expect, it } from "vitest";
import { flagRetailorDrift, flagUnverifiedFacts } from "./factCheck";
import type { ResumeContent, UserProfile } from "@/types";

const PROFILE: UserProfile = {
  id: "p1",
  user_id: "u1",
  work_rights: "Australian citizen",
  phone: "0400 000 000",
  location: "Parramatta, NSW",
  linkedin_url: null,
  work_experience: [
    {
      job_title: "Business Analyst",
      company: "Woolworths Group",
      location: "Sydney, NSW",
      start_date: "2022",
      end_date: "Present",
      description: "Led process improvement initiatives that cut reporting time by 30%.",
    },
  ],
  education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
  skills: ["SQL", "Excel"],
  referees: [{ name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" }],
  raw_linkedin_paste: null,
  updated_at: "2024-01-01",
};

function baseResume(overrides: Partial<ResumeContent> = {}): ResumeContent {
  return {
    contact: { name: "Jamie", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
    summary: "",
    skills: [],
    experience: [
      {
        job_title: "Business Analyst",
        company: "Woolworths Group",
        company_description: "",
        location: "Sydney, NSW",
        start_date: "2022",
        end_date: "Present",
        bullets: ["Cut reporting time by 30% through process improvements."],
      },
    ],
    education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
    referees: [{ name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" }],
    ...overrides,
  };
}

describe("flagUnverifiedFacts", () => {
  it("returns no flags for a resume faithful to the profile", () => {
    expect(flagUnverifiedFacts(baseResume(), PROFILE)).toEqual([]);
  });

  it("flags a fabricated metric not present in the profile description", () => {
    const resume = baseResume({
      experience: [
        {
          ...baseResume().experience[0],
          bullets: ["Increased revenue by 500% through strategic initiatives."],
        },
      ],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.value === "500%")).toBe(true);
  });

  it("flags a company that doesn't match the profile", () => {
    const resume = baseResume({
      experience: [{ ...baseResume().experience[0], company: "Made Up Corp" }],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.message.includes("Company"))).toBe(true);
  });

  it("flags a referee not present in the profile", () => {
    const resume = baseResume({
      referees: [{ name: "Fake Referee", title: "CEO", organisation: "Nowhere Inc", phone: "", email: "" }],
    });
    const flags = flagUnverifiedFacts(resume, PROFILE);
    expect(flags.some((f) => f.location.startsWith("Referee"))).toBe(true);
  });

  it("does not flag a role reordered relative to the profile", () => {
    const reorderedProfile: UserProfile = {
      ...PROFILE,
      work_experience: [
        {
          job_title: "Data Analyst",
          company: "Coles",
          location: "Melbourne, VIC",
          start_date: "2019",
          end_date: "2022",
          description: "Built dashboards used by regional managers.",
        },
        PROFILE.work_experience[0],
      ],
    };
    // Resume still lists Woolworths first even though it's second in the profile array.
    expect(flagUnverifiedFacts(baseResume(), reorderedProfile)).toEqual([]);
  });
});

describe("flagRetailorDrift", () => {
  it("returns no flags when retailoring only changes summary/skills", () => {
    const original = baseResume();
    const retailored = baseResume({ summary: "A retailored summary.", skills: ["SQL", "Stakeholder management"] });
    expect(flagRetailorDrift(retailored, original)).toEqual([]);
  });

  it("flags a metric introduced during retailoring that wasn't in the original bullets", () => {
    const original = baseResume();
    const retailored = baseResume({
      experience: [{ ...baseResume().experience[0], bullets: ["Delivered a 90% improvement in throughput."] }],
    });
    const flags = flagRetailorDrift(retailored, original);
    expect(flags.some((f) => f.value === "90%")).toBe(true);
  });

  it("flags dates that changed during retailoring", () => {
    const original = baseResume();
    const retailored = baseResume({
      experience: [{ ...baseResume().experience[0], start_date: "2015" }],
    });
    const flags = flagRetailorDrift(retailored, original);
    expect(flags.some((f) => f.message.includes("Dates"))).toBe(true);
  });
});
