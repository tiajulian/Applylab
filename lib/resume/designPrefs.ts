import { LINE_HEIGHT_AT_FULL_SPACING } from "@/lib/resume/templateDensity";
import { MODERN_CURATED_ACCENTS, type CuratedAccent } from "@/lib/resume/templateMetadata";

/**
 * The Design & Font panel's curated, resume-level overrides - each layered on top of a template's
 * own TemplateTokens/TemplateDensity defaults, never replacing them. `null`/undefined on a resume
 * row always means "use the template's own default", so every existing resume (all five fields
 * unset) renders exactly as it did before this module existed.
 *
 * Every option here is a closed, vetted set (not a free color/font/number picker) for the same
 * reason the font picker itself is curated rather than an open Google Fonts catalog: cheap to
 * validate, cheap to test exhaustively, and keeps every combination ATS-safe/legible by
 * construction rather than by hoping the user picks something reasonable.
 */

export interface FontChoice {
  id: string;
  label: string;
  /** CSS font-family stack for the canvas/PDF (both are real browser/Chromium rendering - see
   * lib/pdf/pageFit.ts's own comment on why no font-embedding is needed for a web-safe stack). */
  fontFamily: string;
  /** Exact font name the `docx` export library resolves - must be a real, commonly-installed
   * Windows/Office font name, not a CSS stack, since Word has no fallback-list concept here. */
  docxFont: string;
}

export const FONT_CHOICES: readonly FontChoice[] = [
  { id: "arial", label: "Arial", fontFamily: "Arial, Helvetica, sans-serif", docxFont: "Arial" },
  { id: "calibri", label: "Calibri", fontFamily: "Calibri, Candara, Segoe, 'Segoe UI', Optima, Arial, sans-serif", docxFont: "Calibri" },
  { id: "georgia", label: "Georgia", fontFamily: "Georgia, 'Times New Roman', Times, serif", docxFont: "Georgia" },
  { id: "times_new_roman", label: "Times New Roman", fontFamily: "'Times New Roman', Times, serif", docxFont: "Times New Roman" },
  { id: "garamond", label: "Garamond", fontFamily: "Garamond, 'Times New Roman', serif", docxFont: "Garamond" },
  { id: "verdana", label: "Verdana", fontFamily: "Verdana, Geneva, sans-serif", docxFont: "Verdana" },
] as const;

export type FontChoiceId = (typeof FONT_CHOICES)[number]["id"];

export function isFontChoiceId(value: unknown): value is FontChoiceId {
  return typeof value === "string" && FONT_CHOICES.some((f) => f.id === value);
}

export function fontChoiceById(id: string | null | undefined): FontChoice | null {
  return FONT_CHOICES.find((f) => f.id === id) ?? null;
}

/** Same curated swatches the "modern" template's accent picker already uses (lib/resume/
 * templateMetadata.ts) - neutral, professional colors with no reason to stay modern-only, so the
 * Design panel reuses this exact list rather than defining a second, near-duplicate palette. */
export const ACCENT_SWATCHES: readonly CuratedAccent[] = MODERN_CURATED_ACCENTS;

export function isAccentColorHex(value: unknown): value is string {
  return typeof value === "string" && ACCENT_SWATCHES.some((a) => a.hex === value);
}

export type MarginPreset = "compact" | "standard" | "spacious";
export const MARGIN_PRESETS: readonly MarginPreset[] = ["compact", "standard", "spacious"] as const;

/** "standard" is exactly today's hardcoded PAGE_MARGIN_MM (lib/pdf/pageFit.ts) - a resume with no
 * preset set renders with an identical margin to before this feature existed. */
export const MARGIN_MM: Record<MarginPreset, number> = {
  compact: 10,
  standard: 13,
  spacious: 16,
};

export type SpacingPreset = "compact" | "standard" | "spacious";
export const SPACING_PRESETS: readonly SpacingPreset[] = ["compact", "standard", "spacious"] as const;

/** Seeds the PDF trim ladder's *starting* spacingScale (lib/pdf/trimLadder.ts) the same way the
 * font-size stepper already seeds its starting fontPt - "spacious" is a preference, not a
 * guarantee, so the ladder can still trim it down if the resume doesn't fit on its own. "standard"
 * is exactly today's DEFAULT_DENSITY.spacingScale (1), so an unset resume is unaffected. */
export const SPACING_START_SCALE: Record<SpacingPreset, number> = {
  compact: 0.85,
  standard: 1,
  spacious: 1.15,
};

export type LineHeightPreset = "compact" | "standard" | "relaxed";
export const LINE_HEIGHT_PRESETS: readonly LineHeightPreset[] = ["compact", "standard", "relaxed"] as const;

/** The new full-density ceiling lineHeightFor (lib/resume/templateDensity.ts) scales toward,
 * replacing the hardcoded LINE_HEIGHT_AT_FULL_SPACING constant as that function's upper bound - the
 * trim ladder's existing floor (LINE_HEIGHT_AT_FLOOR_SPACING) is untouched, so a "relaxed" pick can
 * still be trimmed down under content overflow the same way today's spacing already can. "standard"
 * is exactly LINE_HEIGHT_AT_FULL_SPACING (1.2), so an unset resume is unaffected. */
export const LINE_HEIGHT_CEILING: Record<LineHeightPreset, number> = {
  compact: 1.1,
  standard: LINE_HEIGHT_AT_FULL_SPACING,
  relaxed: 1.3,
};

export function isMarginPreset(value: unknown): value is MarginPreset {
  return typeof value === "string" && (MARGIN_PRESETS as readonly string[]).includes(value);
}

export function isSpacingPreset(value: unknown): value is SpacingPreset {
  return typeof value === "string" && (SPACING_PRESETS as readonly string[]).includes(value);
}

export function isLineHeightPreset(value: unknown): value is LineHeightPreset {
  return typeof value === "string" && (LINE_HEIGHT_PRESETS as readonly string[]).includes(value);
}

/** A resume row's five optional design fields, exactly as stored (see supabase/migrations - each
 * is nullable, `null`/undefined meaning "use the template's own default"). Central so every
 * consumer (API route validation, PDF/DOCX/canvas rendering) reads the same shape. */
export interface ResumeDesignPrefs {
  accentColor: string | null;
  fontChoice: FontChoiceId | null;
  marginPreset: MarginPreset | null;
  spacingPreset: SpacingPreset | null;
  lineHeightPreset: LineHeightPreset | null;
}

export const DEFAULT_DESIGN_PREFS: ResumeDesignPrefs = {
  accentColor: null,
  fontChoice: null,
  marginPreset: null,
  spacingPreset: null,
  lineHeightPreset: null,
};

export function marginMmFor(prefs: Pick<ResumeDesignPrefs, "marginPreset">): number {
  return MARGIN_MM[prefs.marginPreset ?? "standard"];
}

export function spacingStartScaleFor(prefs: Pick<ResumeDesignPrefs, "spacingPreset">): number {
  return SPACING_START_SCALE[prefs.spacingPreset ?? "standard"];
}

export function lineHeightCeilingFor(prefs: Pick<ResumeDesignPrefs, "lineHeightPreset">): number {
  return LINE_HEIGHT_CEILING[prefs.lineHeightPreset ?? "standard"];
}
