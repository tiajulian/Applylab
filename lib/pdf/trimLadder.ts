import {
  DEFAULT_DENSITY,
  FONT_FLOOR_PT,
  SPACING_FLOOR_SCALE,
  type TemplateDensity,
} from "@/lib/resume/templateDensity";

export interface TrimState {
  density: TemplateDensity;
}

/**
 * Produces the ordered fit ladder for a resume: state[0] is full density at `baseFontPt` (the
 * user's chosen font size, defaulting to DEFAULT_DENSITY.fontPt), and each subsequent state is
 * strictly tighter - spacing first, then font. Layout only: no step ever hides a section or
 * drops/shortens the user's own text, so the PDF always holds everything the editor shows. Pure
 * and side-effect free so it can be tested without a browser. The fit loop in pageFit.ts tries
 * these states in order, preferring the first one that renders to a single page, otherwise the
 * least aggressive one with the fewest pages rather than compressing everything down to floor
 * density chasing an impossible one page.
 *
 * The font-reduction step always walks down to FONT_FLOOR_PT regardless of `baseFontPt` - a user
 * who picked a larger font still gets the same automatic fit behaviour other users get, just
 * starting from a bigger number, never a smaller floor than everyone else's.
 *
 * `baseSpacingScale` (the Design & Font panel's spacing preset - see lib/resume/designPrefs.ts's
 * spacingStartScaleFor) plays the same seeding role for spacing that `baseFontPt` plays for font:
 * state[0] starts at this value instead of the hardcoded DEFAULT_DENSITY.spacingScale (1). The
 * spacing step's two values ([0.85, SPACING_FLOOR_SCALE]) stay absolute rather than relative to
 * `baseSpacingScale` - for a "spacious" (>1) starting point this means the first reduction is a
 * bigger single jump than the standard case, a minor smoothness trade-off, never a correctness
 * one: the ladder still always reaches the same floor if the resume doesn't fit.
 */
export function buildTrimLadder(
  baseFontPt: number = DEFAULT_DENSITY.fontPt,
  baseSpacingScale: number = DEFAULT_DENSITY.spacingScale
): TrimState[] {
  let density: TemplateDensity = { ...DEFAULT_DENSITY, fontPt: baseFontPt, spacingScale: baseSpacingScale };
  const steps: TrimState[] = [{ density }];

  // 1. Reduce inter-section/inter-bullet spacing, one step then down to the floor (skipping any
  // step a compact preset already starts at or below).
  for (const spacingScale of [0.85, SPACING_FLOOR_SCALE].filter((scale) => scale < baseSpacingScale)) {
    density = { ...density, spacingScale };
    steps.push({ density });
  }

  // 2. Reduce base font in 0.5pt steps down to the floor.
  for (let fontPt = baseFontPt - 0.5; fontPt >= FONT_FLOOR_PT; fontPt -= 0.5) {
    density = { ...density, fontPt };
    steps.push({ density });
  }

  return steps;
}
