import { describe, expect, it } from "vitest";
import { buildTrimLadder } from "./trimLadder";
import { FONT_FLOOR_PT, SPACING_FLOOR_SCALE } from "@/lib/resume/templateDensity";

describe("buildTrimLadder", () => {
  it("starts at full density", () => {
    expect(buildTrimLadder()[0]).toEqual({ density: { fontPt: 10, spacingScale: 1 } });
  });

  it("starts from the user's chosen font and spacing", () => {
    expect(buildTrimLadder(11, 1.1)[0]).toEqual({ density: { fontPt: 11, spacingScale: 1.1 } });
  });

  it("reduces spacing down to the floor before touching the font", () => {
    const ladder = buildTrimLadder();
    expect(ladder[1].density).toEqual({ fontPt: 10, spacingScale: 0.85 });
    expect(ladder[2].density).toEqual({ fontPt: 10, spacingScale: SPACING_FLOOR_SCALE });
  });

  it("skips spacing steps a compact preset already starts at", () => {
    const ladder = buildTrimLadder(10, 0.85);
    expect(ladder.map((s) => s.density.spacingScale).slice(0, 2)).toEqual([0.85, SPACING_FLOOR_SCALE]);
  });

  it("then reduces font in 0.5pt steps down to the floor, never below it", () => {
    const fontSteps = buildTrimLadder(11).slice(3).map((s) => s.density.fontPt);
    expect(fontSteps).toEqual([10.5, 10, 9.5]);
    expect(Math.min(...fontSteps)).toBe(FONT_FLOOR_PT);
  });

  it("only ever changes layout, never content", () => {
    for (const state of buildTrimLadder(12)) {
      expect(Object.keys(state)).toEqual(["density"]);
      expect(Object.keys(state.density).sort()).toEqual(["fontPt", "spacingScale"]);
    }
  });
});
