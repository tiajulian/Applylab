import { describe, expect, it } from "vitest";
import { stripBulletPrefix } from "./cleanBullet";

describe("stripBulletPrefix", () => {
  it("strips standard bullet character (•)", () => {
    expect(stripBulletPrefix("• Developed and maintained data assets")).toBe(
      "Developed and maintained data assets"
    );
  });

  it("strips multiple bullet characters and leading whitespace", () => {
    expect(stripBulletPrefix("• • Developed and maintained data assets")).toBe(
      "Developed and maintained data assets"
    );
    expect(stripBulletPrefix("  •   Developed and maintained data assets")).toBe(
      "Developed and maintained data assets"
    );
  });

  it("strips dash, asterisk, and unicode bullet variations", () => {
    expect(stripBulletPrefix("- Built data pipelines")).toBe("Built data pipelines");
    expect(stripBulletPrefix("* Built data pipelines")).toBe("Built data pipelines");
    expect(stripBulletPrefix("\u2022 Built data pipelines")).toBe("Built data pipelines");
    expect(stripBulletPrefix("\u25E6 Built data pipelines")).toBe("Built data pipelines");
  });

  it("returns unchanged text if no leading bullet exists", () => {
    expect(stripBulletPrefix("Reviewed and quality-assured data assets")).toBe(
      "Reviewed and quality-assured data assets"
    );
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(stripBulletPrefix("")).toBe("");
    expect(stripBulletPrefix(null)).toBe("");
    expect(stripBulletPrefix(undefined)).toBe("");
  });
});
