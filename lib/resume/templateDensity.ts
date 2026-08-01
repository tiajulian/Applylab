// Shared by the templates (as a render prop) and lib/pdf/pageFit.ts (as the trim ladder's
// output), so both sides agree on what "how dense is this render" means.
export interface TemplateDensity {
  fontPt: number;
  spacingScale: number;
  showRefereeLine: boolean;
}

export const DEFAULT_DENSITY: TemplateDensity = {
  fontPt: 10.5,
  spacingScale: 1,
  showRefereeLine: true,
};

export const FONT_FLOOR_PT = 9.5;
export const SPACING_FLOOR_SCALE = 0.7;

const LINE_HEIGHT_AT_FULL_SPACING = 1.4;
const LINE_HEIGHT_AT_FLOOR_SPACING = 1.15;

/** Line-height is a spacing lever too (the trim ladder's spacing steps drive it down alongside
 * margins), scaled linearly between full density and the spacing floor. */
export function lineHeightFor(spacingScale: number): number {
  const t = (spacingScale - SPACING_FLOOR_SCALE) / (1 - SPACING_FLOOR_SCALE);
  return LINE_HEIGHT_AT_FLOOR_SPACING + Math.max(0, Math.min(1, t)) * (LINE_HEIGHT_AT_FULL_SPACING - LINE_HEIGHT_AT_FLOOR_SPACING);
}
