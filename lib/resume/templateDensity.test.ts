import { describe, expect, it } from "vitest";
import {
  LINE_HEIGHT_AT_FLOOR_SPACING,
  LINE_HEIGHT_AT_FULL_SPACING,
  SPACING_FLOOR_SCALE,
  lineHeightFor,
} from "./templateDensity";

describe("lineHeightFor", () => {
  it("defaults to LINE_HEIGHT_AT_FULL_SPACING at full spacing when no ceiling is given", () => {
    expect(lineHeightFor(1)).toBe(LINE_HEIGHT_AT_FULL_SPACING);
  });

  it("reaches the same floor at the spacing floor regardless of ceiling", () => {
    expect(lineHeightFor(SPACING_FLOOR_SCALE)).toBe(LINE_HEIGHT_AT_FLOOR_SPACING);
    expect(lineHeightFor(SPACING_FLOOR_SCALE, 1.3)).toBe(LINE_HEIGHT_AT_FLOOR_SPACING);
    expect(lineHeightFor(SPACING_FLOOR_SCALE, 1.1)).toBe(LINE_HEIGHT_AT_FLOOR_SPACING);
  });

  it("an overridden ceiling replaces LINE_HEIGHT_AT_FULL_SPACING at full spacing", () => {
    expect(lineHeightFor(1, 1.3)).toBe(1.3);
    expect(lineHeightFor(1, 1.1)).toBe(1.1);
  });

  it("an overridden ceiling can still be trimmed down toward the floor as spacingScale drops", () => {
    const atFull = lineHeightFor(1, 1.3);
    const atMid = lineHeightFor(0.9, 1.3);
    const atFloor = lineHeightFor(SPACING_FLOOR_SCALE, 1.3);
    expect(atMid).toBeLessThan(atFull);
    expect(atFloor).toBeLessThan(atMid);
  });
});
