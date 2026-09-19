import { describe, expect, it } from "vitest";
import { DEFAULT_RESUME_SECTION_ORDER, effectiveSectionOrder } from "./resumeSections";

describe("effectiveSectionOrder", () => {
  it("prefers the user's saved order", () => {
    const saved = ["education", "summary", "experience", "skills", "tools", "projects"] as const;
    expect(effectiveSectionOrder([...saved], true)).toEqual(saved);
  });

  it("falls back to the standard order, or skills-first for templates that promote skills", () => {
    expect(effectiveSectionOrder(undefined, false)).toEqual(DEFAULT_RESUME_SECTION_ORDER);
    expect(effectiveSectionOrder(undefined, true)).toEqual(["summary", "skills", "tools", "experience", "projects", "education"]);
  });
});
