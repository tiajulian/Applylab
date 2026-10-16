import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeNextPath";

describe("safeNextPath", () => {
  it("keeps in-app paths", () => {
    expect(safeNextPath("/resume/new?firstrun=1")).toBe("/resume/new?firstrun=1");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "@evil.com", "https://evil.com", "evil.com", "", null, undefined]) {
      expect(safeNextPath(bad)).toBe("/dashboard");
    }
    expect(safeNextPath("//evil.com", "/")).toBe("/");
  });
});
