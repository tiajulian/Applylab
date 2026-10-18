import { describe, expect, it } from "vitest";
import { cleanSnippet } from "./format";

describe("cleanSnippet", () => {
  it("drops an ATS field-label block before the description", () => {
    const raw =
      "Line of Service Internal Firm Services Industry/Sector Not Applicable Specialism IFS - Information Technology (IT) Management Level Senior Associate Job Description & Summary A career in our team will see you build data pipelines.";
    expect(cleanSnippet(raw)).toBe("A career in our team will see you build data pipelines.");
  });

  it("leaves an ordinary ad alone", () => {
    const raw = "Join our Melbourne division as a data analyst. Line of service work across teams.";
    expect(cleanSnippet(raw)).toBe(raw);
  });

  it("shows nothing rather than only field labels", () => {
    expect(cleanSnippet("Line of Service Advisory Industry/Sector Banking Specialism Risk")).toBe("");
  });
});
