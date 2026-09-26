import { describe, expect, it } from "vitest";
import { GENERAL_RESUME_TITLE, targetJobTitle } from "./generalResume";

describe("targetJobTitle", () => {
  it("hides the general-resume label so it never acts as a real role", () => {
    expect(targetJobTitle(GENERAL_RESUME_TITLE)).toBeNull();
  });

  it("passes real titles through and normalises empty values to null", () => {
    expect(targetJobTitle("Business Analyst")).toBe("Business Analyst");
    expect(targetJobTitle("")).toBeNull();
    expect(targetJobTitle(null)).toBeNull();
    expect(targetJobTitle(undefined)).toBeNull();
  });
});
