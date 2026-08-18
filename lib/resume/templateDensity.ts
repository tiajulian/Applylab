// Shared by the templates (as a render prop) and lib/pdf/pageFit.ts (as the trim ladder's
// output), so both sides agree on what "how dense is this render" means.
export interface TemplateDensity {
  fontPt: number;
  spacingScale: number;
  showRefereeLine: boolean;
  /** Projects is explicitly optional content (per the resume style guide) - the first thing the
   * trim ladder drops, ahead of even the referee line, since one dropped project section reclaims
   * far more space per step than one referee line does. */
  showProjects: boolean;
}

export const DEFAULT_DENSITY: TemplateDensity = {
  fontPt: 10,
  spacingScale: 1,
  showRefereeLine: true,
  showProjects: true,
};

export const FONT_FLOOR_PT = 9.5;
export const SPACING_FLOOR_SCALE = 0.7;

// Discrete font-size choices for the resume editor's stepper (components/resume/
// FontSizeStepper.tsx). Floor matches FONT_FLOOR_PT exactly - the stepper never offers a value
// the automatic trim ladder wouldn't already be willing to reach on its own.
export const FONT_SIZE_STEPS = [9.5, 10, 10.5, 11, 11.5, 12] as const;
export type FontSizePt = (typeof FONT_SIZE_STEPS)[number];

export function isValidFontSizePt(value: unknown): value is FontSizePt {
  return typeof value === "number" && (FONT_SIZE_STEPS as readonly number[]).includes(value);
}

/** Falls back to the default when the stored/raw value isn't one of the discrete steps (e.g. a
 * resume row from before this column existed, or a schema/client type mismatch). */
export function clampFontSizePt(value: number | null | undefined): FontSizePt {
  return isValidFontSizePt(value) ? value : (DEFAULT_DENSITY.fontPt as FontSizePt);
}

// Tight, near-single-spaced leading for body text/bullets - the single place to nudge overall
// leading after seeing a rendered PDF. Full spacing is the normal/default case; floor spacing is
// only reached via the trim ladder for dense resumes. Never let either exceed 1.3.
export const LINE_HEIGHT_AT_FULL_SPACING = 1.2;
export const LINE_HEIGHT_AT_FLOOR_SPACING = 1.15;

// The summary paragraph reads a hair looser than bullets/body, independent of the spacing lever.
export const SUMMARY_LINE_HEIGHT = 1.25;

/** Line-height is a spacing lever too (the trim ladder's spacing steps drive it down alongside
 * margins), scaled linearly between full density and the spacing floor. */
export function lineHeightFor(spacingScale: number): number {
  const t = (spacingScale - SPACING_FLOOR_SCALE) / (1 - SPACING_FLOOR_SCALE);
  return LINE_HEIGHT_AT_FLOOR_SPACING + Math.max(0, Math.min(1, t)) * (LINE_HEIGHT_AT_FULL_SPACING - LINE_HEIGHT_AT_FLOOR_SPACING);
}
