import { describe, expect, it } from "vitest";
import { sanitizeDashes, sanitizeDeep } from "./sanitizeDashes";

describe("sanitizeDashes", () => {
  it("converts a spaced date range en dash to a hyphen", () => {
    expect(sanitizeDashes("2019 – 2020")).toBe("2019 - 2020");
  });

  it("converts an em dash date range to a hyphen", () => {
    expect(sanitizeDashes("Jan 2019 — Dec 2020")).toBe("Jan 2019 - Dec 2020");
  });

  it("converts a tight digit-adjacent en dash to a spaced hyphen", () => {
    expect(sanitizeDashes("2019–2020")).toBe("2019 - 2020");
  });

  it("converts a date range ending in Present to a hyphen", () => {
    expect(sanitizeDashes("2022 – Present")).toBe("2022 - Present");
  });

  it("converts a prose em dash to a comma", () => {
    expect(sanitizeDashes("fast — efficient")).toBe("fast, efficient");
  });

  it("converts a prose dash with no surrounding spaces to a comma", () => {
    expect(sanitizeDashes("Led team—delivered results")).toBe("Led team, delivered results");
  });

  it("handles multiple dashes in one string", () => {
    expect(sanitizeDashes("2019 – 2020 — great year")).toBe("2019 - 2020, great year");
  });

  it("leaves text with no dashes untouched", () => {
    expect(sanitizeDashes("Led process improvement, cut reporting time by 30%.")).toBe(
      "Led process improvement, cut reporting time by 30%."
    );
  });

  it("converts em dashes in complex project bullets into clean commas without duplicate punctuation", () => {
    const input =
      "Architected a full-stack platform, engineering a key design decision between static storage and dynamic generation — ultimately implementing Claude-powered dialogue synthesis.";
    expect(sanitizeDashes(input)).toBe(
      "Architected a full-stack platform, engineering a key design decision between static storage and dynamic generation, ultimately implementing Claude-powered dialogue synthesis."
    );
  });

  it("handles em dashes following punctuation cleanly without doubling commas", () => {
    expect(sanitizeDashes("automated scoring feedback, and session persistence — delivering a solution")).toBe(
      "automated scoring feedback, and session persistence, delivering a solution"
    );
  });

  it("never leaves an em or en dash in the output", () => {
    const inputs = ["2019 – 2020", "fast — efficient", "2022–Present", "a — b — c"];
    for (const input of inputs) {
      expect(sanitizeDashes(input)).not.toMatch(/[—–]/);
    }
  });
});

describe("sanitizeDeep", () => {
  it("sanitizes every string field in a nested object", () => {
    const result = sanitizeDeep({
      summary: "Delivered results — on time.",
      experience: [{ start_date: "2019", end_date: "2020", bullets: ["Cut costs — by 20%."] }],
      skills: ["Data analysis — SQL"],
    });

    expect(result.summary).toBe("Delivered results, on time.");
    expect(result.experience[0].bullets[0]).toBe("Cut costs, by 20%.");
    expect(result.skills[0]).toBe("Data analysis, SQL");
  });

  it("leaves non-string values untouched", () => {
    expect(sanitizeDeep(42)).toBe(42);
    expect(sanitizeDeep(null)).toBe(null);
    expect(sanitizeDeep(true)).toBe(true);
  });
});
