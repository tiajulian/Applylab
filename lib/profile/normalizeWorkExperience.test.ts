import { describe, expect, it } from "vitest";
import { normalizeWorkExperience } from "./normalizeWorkExperience";

describe("normalizeWorkExperience", () => {
  it("returns an empty array for null/undefined input", () => {
    expect(normalizeWorkExperience(null)).toEqual([]);
    expect(normalizeWorkExperience(undefined)).toEqual([]);
  });

  it("leaves an entry that already has a wins array unchanged", () => {
    const entries = [
      {
        job_title: "Operations Coordinator",
        company: "Coles",
        location: "Melbourne, VIC",
        start_date: "2022",
        end_date: "Present",
        description: "Ran daily fulfilment operations.",
        wins: [{ text: "Cut backlog by half", metric: "50%" }],
      },
    ];
    expect(normalizeWorkExperience(entries)).toEqual(entries);
  });

  it("migrates a legacy achievement/achievement_metric row into a one-item wins list", () => {
    const legacyEntry = {
      job_title: "Warehouse Picker",
      company: "Woolworths",
      location: "Sydney, NSW",
      start_date: "2019",
      end_date: "2021",
      description: "Picked and packed orders.",
      achievement: "Reorganised the pick line",
      achievement_metric: "20% faster",
    };
    const result = normalizeWorkExperience([legacyEntry as never]);
    expect(result[0].wins).toEqual([{ text: "Reorganised the pick line", metric: "20% faster" }]);
  });

  it("gives an entry with neither wins nor a legacy achievement an empty wins array, not undefined", () => {
    const bareEntry = {
      job_title: "Cashier",
      company: "Aldi",
      location: "Perth, WA",
      start_date: "2018",
      end_date: "2019",
      description: "Operated the register.",
    };
    const result = normalizeWorkExperience([bareEntry as never]);
    expect(result[0].wins).toEqual([]);
  });

  it("does not migrate a legacy achievement with only whitespace", () => {
    const entry = {
      job_title: "Cashier",
      company: "Aldi",
      location: "Perth, WA",
      start_date: "2018",
      end_date: "2019",
      description: "Operated the register.",
      achievement: "   ",
    };
    const result = normalizeWorkExperience([entry as never]);
    expect(result[0].wins).toEqual([]);
  });
});
