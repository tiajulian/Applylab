import { describe, expect, it } from "vitest";
import {
  computeCompleteness,
  getImprovementSuggestions,
  getMissingMvpFields,
  getProfileCompleteness,
  joinSuggestions,
  meetsMVP,
  type ScorableProfile,
} from "./completeness";

const EMPTY_PROFILE: ScorableProfile = {
  fullName: "",
  work_rights: null,
  phone: null,
  location: null,
  linkedin_url: null,
  work_experience: [],
  education: [],
  skills: [],
  referees: [],
  raw_linkedin_paste: null,
};

const PARTIAL_PROFILE: ScorableProfile = {
  ...EMPTY_PROFILE,
  fullName: "Jamie Citizen",
  skills: ["SQL", "Excel"],
  education: [
    { degree: "Bachelor of Arts", institution: "University of Sydney", start_date: "", end_date: "2020", is_current: false, notes: "" },
  ],
};

const FULL_PROFILE: ScorableProfile = {
  fullName: "Jamie Citizen",
  work_rights: "Australian citizen",
  phone: "0400 000 000",
  location: "Parramatta, NSW",
  linkedin_url: "https://linkedin.com/in/jamiecitizen",
  raw_linkedin_paste: null,
  skills: [
    "SQL",
    "Excel",
    "Stakeholder Management",
    "Project Coordination",
    "Power BI",
    "Python",
    "Agile Delivery",
    "Data Modeling",
  ],
  work_experience: [
    {
      job_title: "Business Analyst",
      company: "Woolworths Group",
      location: "Sydney, NSW",
      start_date: "2022",
      end_date: "Present",
      is_current: true,
      description: "Led process improvement initiatives that cut reporting time by 30%.",
      wins: [{ text: "Cut weekly reporting time by 30%", metric: "30%" }],
    },
    {
      job_title: "Data Analyst",
      company: "Coles",
      location: "Melbourne, VIC",
      start_date: "2019",
      end_date: "2022",
      is_current: false,
      description: "Built dashboards used by regional managers across 40 stores.",
      wins: [{ text: "Built executive dashboards across 40 stores", metric: "40 stores" }],
    },
    {
      job_title: "Analyst Intern",
      company: "Telstra",
      location: "Melbourne, VIC",
      start_date: "2018",
      end_date: "2019",
      is_current: false,
      description: "Supported the finance team with ad-hoc reporting and analysis.",
      wins: [{ text: "Automated monthly reconciliations saving 5 hours/week", metric: "5 hours" }],
    },
  ],
  education: [
    { degree: "Bachelor of Commerce", institution: "University of Melbourne", start_date: "", end_date: "2018", is_current: false, notes: "" },
    { degree: "Diploma of Business", institution: "TAFE NSW", start_date: "", end_date: "2015", is_current: false, notes: "" },
  ],
  referees: [
    { name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" },
    { name: "Sam Boss", title: "Manager", organisation: "Coles", phone: "0400 222 222", email: "sam@example.com" },
  ],
};

describe("computeCompleteness", () => {
  it("scores an empty profile as 0", () => {
    expect(computeCompleteness(EMPTY_PROFILE)).toBe(0);
  });

  it("scores a partial profile between 0 and 100", () => {
    const score = computeCompleteness(PARTIAL_PROFILE);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("scores a fully filled-out profile as 100", () => {
    expect(computeCompleteness(FULL_PROFILE)).toBe(100);
  });
});

describe("meetsMVP / getMissingMvpFields", () => {
  it("fails an empty profile and reports every missing field", () => {
    expect(meetsMVP(EMPTY_PROFILE)).toBe(false);
    expect(getMissingMvpFields(EMPTY_PROFILE)).toEqual([
      "fullName",
      "experience",
      "skills",
      "location",
      "workRights",
    ]);
  });

  it("fails a partial profile missing experience/location/workRights", () => {
    expect(meetsMVP(PARTIAL_PROFILE)).toBe(false);
    expect(getMissingMvpFields(PARTIAL_PROFILE)).toEqual(["experience", "skills", "location", "workRights"]);
  });

  it("passes a fully filled-out profile", () => {
    expect(meetsMVP(FULL_PROFILE)).toBe(true);
    expect(getMissingMvpFields(FULL_PROFILE)).toEqual([]);
  });

  it("re-engages when experience is later removed", () => {
    const droppedExperience: ScorableProfile = { ...FULL_PROFILE, work_experience: [] };
    expect(meetsMVP(droppedExperience)).toBe(false);
    expect(getMissingMvpFields(droppedExperience)).toEqual(["experience"]);
  });
});

const MVP_COMPLETE_BUT_PARTIAL: ScorableProfile = {
  fullName: "Jamie Citizen",
  work_rights: "Australian citizen",
  phone: null,
  location: "Parramatta, NSW",
  linkedin_url: null,
  raw_linkedin_paste: null,
  skills: ["SQL", "Excel", "Stakeholder Management"],
  work_experience: [
    {
      job_title: "Business Analyst",
      company: "Woolworths Group",
      location: "Sydney, NSW",
      start_date: "2022",
      end_date: "Present",
      is_current: false,
      description: "Led process improvement initiatives.",
      wins: [],
    },
  ],
  education: [],
  referees: [],
};

describe("getImprovementSuggestions / joinSuggestions", () => {
  it("returns nothing for a fully complete profile", () => {
    expect(getImprovementSuggestions(FULL_PROFILE)).toEqual([]);
  });

  it("suggests the highest-impact gaps first, capped at the default max", () => {
    const suggestions = getImprovementSuggestions(MVP_COMPLETE_BUT_PARTIAL);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toBe("2 more skills");
  });

  it("joins suggestions the way the banner copy expects", () => {
    expect(joinSuggestions(["your phone number"])).toBe("your phone number");
    expect(joinSuggestions(["your phone number", "2 more skills"])).toBe("your phone number and 2 more skills");
    expect(joinSuggestions([])).toBe("");
  });
});

describe("getProfileCompleteness (Spec 07 structured tasks)", () => {
  it("returns 9 tasks summing to 100 weight", () => {
    const res = getProfileCompleteness(EMPTY_PROFILE);
    expect(res.tasks).toHaveLength(9);
    const totalWeight = res.tasks.reduce((sum, t) => sum + t.weight, 0);
    expect(totalWeight).toBe(100);
    expect(res.percent).toBe(0);
    expect(res.tasks.every((t) => !t.done)).toBe(true);
  });

  it("interpolates shortfall in labels", () => {
    const res = getProfileCompleteness({
      ...EMPTY_PROFILE,
      skills: ["SQL", "Excel"],
    });

    const skillsTask = res.tasks.find((t) => t.id === "skills_min");
    expect(skillsTask?.label).toBe("Add 6 more skills with evidence");
    expect(skillsTask?.done).toBe(false);
  });

  it("reaches 100% on fully populated profile", () => {
    const res = getProfileCompleteness(FULL_PROFILE);
    expect(res.percent).toBe(100);
    expect(res.tasks.every((t) => t.done)).toBe(true);
    expect(res.nextTasks).toHaveLength(0);
  });
});
