import { describe, expect, it } from "vitest";
import { profileFromRow, profileToRow, validateProfileInput } from "@/lib/jobs/profile";
import { parseMatchQuery, toJobDto } from "@/lib/jobs/api";

const valid = {
  targetTitles: ["Frontend Developer"],
  skills: ["React"],
  locations: ["Sydney"],
  searchRadiusKm: 50,
  remoteOk: true,
  minSalary: 100000,
  contractTypes: ["full_time", "permanent"],
  seniority: "mid",
  resumeText: "  I build things.  ",
};

describe("validateProfileInput", () => {
  it("accepts a valid profile and normalises it", () => {
    const { input, errors } = validateProfileInput({
      ...valid,
      targetTitles: ["  Frontend   Developer ", "frontend developer", ""],
    });
    expect(errors).toEqual({});
    expect(input).toEqual({ ...valid, targetTitles: ["Frontend Developer"], resumeText: "I build things." });
  });

  it("requires at least one target title", () => {
    expect(validateProfileInput({ ...valid, targetTitles: [] }).errors.targetTitles).toMatch(/at least one/);
    expect(validateProfileInput(null).errors.targetTitles).toMatch(/at least one/);
  });

  it("enforces list limits and item length", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `item ${i}`);
    const { errors } = validateProfileInput({
      ...valid,
      targetTitles: many(6),
      skills: many(31),
      locations: many(6),
    });
    expect(Object.keys(errors).sort()).toEqual(["locations", "skills", "targetTitles"]);
    expect(validateProfileInput({ ...valid, skills: ["x".repeat(101)] }).errors.skills).toMatch(/100 characters/);
    expect(validateProfileInput({ ...valid, skills: "React" }).errors.skills).toMatch(/list/);
  });

  it("rejects bad enums, salary and resume length", () => {
    const { errors } = validateProfileInput({
      ...valid,
      contractTypes: ["casual"],
      seniority: "wizard",
      minSalary: 12.5,
      remoteOk: "yes",
      resumeText: "x".repeat(20_001),
    });
    expect(Object.keys(errors).sort()).toEqual(["contractTypes", "minSalary", "remoteOk", "resumeText", "seniority"]);
  });

  it("accepts the range options or anywhere, and defaults to 50 km", () => {
    expect(validateProfileInput({ ...valid, searchRadiusKm: 100 }).input.searchRadiusKm).toBe(100);
    expect(validateProfileInput({ ...valid, searchRadiusKm: null }).input.searchRadiusKm).toBeNull();
    expect(validateProfileInput(valid).input.searchRadiusKm).toBe(50);
    expect(validateProfileInput({ ...valid, searchRadiusKm: 37 }).errors.searchRadiusKm).toMatch(/Range/);
  });

  it("treats a zero minimum salary and blank resume as not set", () => {
    const { input } = validateProfileInput({ ...valid, minSalary: 0, resumeText: "   " });
    expect(input.minSalary).toBeNull();
    expect(input.resumeText).toBeNull();
  });

  it("round-trips through the database row shape", () => {
    const { input } = validateProfileInput(valid);
    const row = { ...profileToRow(input), profile_text: null, embedding: null, updated_at: "", matches_computed_at: null, is_auto: false };
    expect(profileFromRow(row)).toEqual(input);
  });
});

describe("parseMatchQuery", () => {
  const parse = (qs: string) => parseMatchQuery(new URLSearchParams(qs));

  it("applies defaults", () => {
    expect(parse("")).toEqual({
      page: 1,
      limit: 20,
      sort: "score",
      location: null,
      minSalary: null,
      contractTypes: [],
      maxAgeDays: null,
    });
  });

  it("parses every filter", () => {
    expect(parse("page=2&limit=10&sort=newest&location=Perth&minSalary=90000&workType=full_time,contract&postedWithinDays=7")).toEqual({
      page: 2,
      limit: 10,
      sort: "newest",
      location: "Perth",
      minSalary: 90000,
      contractTypes: ["full_time", "contract"],
      maxAgeDays: 7,
    });
  });

  it.each(["page=0", "limit=51", "sort=random", "workType=casual", "minSalary=-1", "postedWithinDays=90", "page=abc"])(
    "rejects %s",
    (qs) => expect(parse(qs)).toBeNull()
  );
});

describe("toJobDto", () => {
  it("maps to the API shape and keeps redirect_url untouched", () => {
    const url = "https://www.adzuna.com.au/land/ad/1?se=abc&utm_source=x";
    expect(
      toJobDto({
        id: "j1",
        title: "Chef",
        company: null,
        location_display: "Perth",
        salary_min: 60000,
        salary_max: 70000,
        salary_is_predicted: true,
        contract_type: null,
        contract_time: "full_time",
        description_snippet: "Cook",
        posted_at: "2026-09-29T00:00:00Z",
        redirect_url: url,
        source: "adzuna",
      })
    ).toEqual({
      id: "j1",
      title: "Chef",
      company: null,
      location: "Perth",
      salaryMin: 60000,
      salaryMax: 70000,
      salaryIsPredicted: true,
      contractType: null,
      contractTime: "full_time",
      snippet: "Cook",
      postedAt: "2026-09-29T00:00:00Z",
      applyUrl: url,
      source: "adzuna",
    });
  });
});
