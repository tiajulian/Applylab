import { describe, expect, it } from "vitest";
import { JOB_TITLE_CATALOG, suggestJobTitles } from "./jobTitleCatalog";
import { SKILL_CATALOG, suggestSkills } from "@/lib/skills/skillCatalog";
import { DEGREE_CATALOG, INSTITUTION_CATALOG } from "@/lib/catalogs/education";
import { suggestionsFromList } from "@/lib/text/fuzzyMatch";

const values = (items: { value: string }[]) => items.map((i) => i.value);

describe("suggestJobTitles", () => {
  it("finds titles by any word, with typos", () => {
    expect(values(suggestJobTitles("data an"))).toContain("Data Analyst");
    expect(values(suggestJobTitles("analyst"))).toContain("Business Analyst");
    expect(values(suggestJobTitles("barsita"))).toContain("Barista");
    expect(values(suggestJobTitles("regsitered nurse"))).toContain("Registered Nurse");
  });

  it("spends typo tolerance per word, not across a phrase", () => {
    expect(values(suggestJobTitles("project man"))).not.toContain("Project Engineer");
    expect(values(suggestJobTitles("data an"))).toEqual(["Data Analyst", "Senior Data Analyst"]);
  });

  it("matches shortened leading words", () => {
    // Through the degree catalog, which has the long forms people shorten.
    expect(suggestionsFromList("cert iv", DEGREE_CATALOG).map((d) => d.value)[0]).toMatch(/^Certificate IV/);
    expect(suggestionsFromList("uni of syd", INSTITUTION_CATALOG).map((d) => d.value)).toContain("University of Sydney");
  });

  it("skips titles already chosen", () => {
    expect(values(suggestJobTitles("chef", ["Chef"]))).not.toContain("Chef");
  });

  it("has no duplicate titles", () => {
    const lower = JOB_TITLE_CATALOG.map((t) => t.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});

describe("suggestSkills", () => {
  it("includes skills and tools", () => {
    expect(values(suggestSkills("stakeh"))).toContain("Stakeholder Management");
    expect(values(suggestSkills("tablea"))).toContain("Tableau");
    expect(values(suggestSkills("rsa"))).toContain("Responsible Service of Alcohol (RSA)");
  });

  it("has no duplicate skills", () => {
    const lower = SKILL_CATALOG.map((t) => t.toLowerCase());
    expect([...new Set(lower)].length).toBe(lower.length);
  });
});
