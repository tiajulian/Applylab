import { describe, expect, it } from "vitest";
import { isThinExperience } from "./thinExperience";

describe("isThinExperience", () => {
  it("flags an empty description", () => {
    expect(isThinExperience({ description: "" })).toBe(true);
  });

  it("flags a bare one-liner (the ABC-role case: real job, barely any tasks written)", () => {
    expect(isThinExperience({ description: "General duties as required." })).toBe(true);
  });

  it("flags a single longer sentence with no second distinct task", () => {
    expect(
      isThinExperience({
        description: "Responsible for a wide range of day-to-day tasks around the store as needed.",
      })
    ).toBe(true);
  });

  it("does not flag a rich, multi-line description (e.g. a filled-out Data Analyst role)", () => {
    expect(
      isThinExperience({
        description: `Built and maintained Power BI dashboards used by regional managers for weekly sales reporting.
Extracted and cleaned data from SQL Server for ad-hoc analysis requests.
Partnered with the finance team to automate a monthly reconciliation report, cutting manual effort by several hours.
Presented findings to senior stakeholders and recommended process changes.`,
      })
    ).toBe(false);
  });

  it("does not flag a dense single-paragraph description with multiple real tasks", () => {
    expect(
      isThinExperience({
        description:
          "Managed rostering and payroll for a team of 12 casual staff. Reconciled till takings at the end of each shift. Trained new starters on POS systems and customer service standards.",
      })
    ).toBe(false);
  });
});
