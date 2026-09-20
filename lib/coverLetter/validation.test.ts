import { describe, expect, it } from "vitest";
import { cleanPrefill, hasPlaceholder, validateCreateInput } from "@/lib/coverLetter/validation";
import { COVER_LETTER_LIMITS } from "@/lib/coverLetter/config";

const valid = { mode: "ai", resumeId: "r1", jobTitle: "Analyst", company: "Suncorp", idempotencyKey: "k" };

describe("cleanPrefill", () => {
  it("empties placeholders and whitespace, keeps real values", () => {
    expect(cleanPrefill("[Job Title]")).toBe("");
    expect(cleanPrefill("  Analyst [Company]  ")).toBe("");
    expect(cleanPrefill("   ")).toBe("");
    expect(cleanPrefill(null)).toBe("");
    expect(cleanPrefill(" Suncorp ")).toBe("Suncorp");
  });

  it("detects placeholders", () => {
    expect(hasPlaceholder("[Company]")).toBe(true);
    expect(hasPlaceholder("Acme")).toBe(false);
  });
});

describe("validateCreateInput", () => {
  it("accepts a complete AI request", () => {
    expect(validateCreateInput(valid).errors).toEqual({});
  });

  it("requires title, company and resume for AI but not for blank", () => {
    const ai = validateCreateInput({ mode: "ai" }).errors;
    expect(ai.jobTitle).toBe("Please enter a job title.");
    expect(ai.company).toBe("Please enter the company name.");
    expect(ai.resumeId).toBeDefined();
    expect(validateCreateInput({ mode: "blank" }).errors).toEqual({});
  });

  it("blocks placeholders even in blank mode", () => {
    expect(validateCreateInput({ mode: "blank", jobTitle: "[Job Title]" }).errors.jobTitle).toMatch(/placeholder/);
  });

  it("enforces length limits", () => {
    const long = "x".repeat(COVER_LETTER_LIMITS.jobDescriptionMax + 1);
    expect(validateCreateInput({ ...valid, jobDescription: long }).errors.jobDescription).toMatch(/too long/);
  });

  it("falls back to defaults for unknown enums and caps focus at 3 distinct values", () => {
    const { input } = validateCreateInput({
      ...valid,
      tone: "sarcastic",
      length: "epic",
      focus: ["Skills", "Skills", "Achievements", "Culture fit", "Relocation", "nope"],
    });
    expect(input.tone).toBe("professional");
    expect(input.length).toBe("standard");
    expect(input.focus).toEqual(["Skills", "Achievements", "Culture fit"]);
  });

  it("treats a non-object body as empty", () => {
    expect(validateCreateInput(null).input.mode).toBe("ai");
  });
});
