import { describe, expect, it } from "vitest";
import { normalizeEducation } from "./normalizeEducation";

describe("normalizeEducation", () => {
  it("returns an empty array for null/undefined input", () => {
    expect(normalizeEducation(null)).toEqual([]);
    expect(normalizeEducation(undefined)).toEqual([]);
  });

  it("leaves an entry that already has the date-range shape unchanged", () => {
    const entries = [
      {
        degree: "Bachelor of Commerce",
        institution: "University of Melbourne",
        start_date: "Feb 2015",
        end_date: "Nov 2018",
        is_current: false,
        notes: "",
      },
    ];
    expect(normalizeEducation(entries)).toEqual(entries);
  });

  it("splits a legacy 'YYYY - YYYY' year range into start_date/end_date", () => {
    const legacyEntry = { degree: "BCom", institution: "University", year: "2015 - 2018", notes: "" };
    const result = normalizeEducation([legacyEntry as never]);
    expect(result[0].start_date).toBe("2015");
    expect(result[0].end_date).toBe("2018");
    expect(result[0].is_current).toBe(false);
  });

  it("infers is_current from a legacy range ending in Present", () => {
    const legacyEntry = { degree: "BCom", institution: "University", year: "2022 - Present", notes: "" };
    const result = normalizeEducation([legacyEntry as never]);
    expect(result[0].start_date).toBe("2022");
    expect(result[0].end_date).toBe("");
    expect(result[0].is_current).toBe(true);
  });

  it("treats a single legacy year as a completion date", () => {
    const legacyEntry = { degree: "BCom", institution: "University", year: "2018", notes: "" };
    const result = normalizeEducation([legacyEntry as never]);
    expect(result[0].start_date).toBe("");
    expect(result[0].end_date).toBe("2018");
    expect(result[0].is_current).toBe(false);
  });

  it("treats a bare legacy 'Present' as currently studying with no dates", () => {
    const legacyEntry = { degree: "BCom", institution: "University", year: "Present", notes: "" };
    const result = normalizeEducation([legacyEntry as never]);
    expect(result[0].start_date).toBe("");
    expect(result[0].end_date).toBe("");
    expect(result[0].is_current).toBe(true);
  });

  it("gives an entry with no year at all empty dates, not undefined", () => {
    const bareEntry = { degree: "BCom", institution: "University", notes: "" };
    const result = normalizeEducation([bareEntry as never]);
    expect(result[0].start_date).toBe("");
    expect(result[0].end_date).toBe("");
    expect(result[0].is_current).toBe(false);
  });

  it("recognizes a legacy 'Ongoing' year as currently studying", () => {
    const legacyEntry = { degree: "BCom", institution: "University", year: "Ongoing", notes: "" };
    const result = normalizeEducation([legacyEntry as never]);
    expect(result[0].is_current).toBe(true);
  });

  it("does not leave a stale legacy `year` key on the migrated object", () => {
    const legacyEntry = { degree: "BCom", institution: "University", year: "2018", notes: "" };
    const result = normalizeEducation([legacyEntry as never]);
    expect(result[0]).not.toHaveProperty("year");
    expect(Object.keys(result[0]).sort()).toEqual(
      ["degree", "end_date", "institution", "is_current", "notes", "start_date"].sort()
    );
  });
});
