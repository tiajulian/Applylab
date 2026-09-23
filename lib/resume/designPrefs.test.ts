import { describe, expect, it } from "vitest";
import {
  ACCENT_SWATCHES,
  DEFAULT_DESIGN_PREFS,
  FONT_CHOICES,
  LINE_HEIGHT_CEILING,
  MARGIN_MM,
  SPACING_START_SCALE,
  fontChoiceById,
  isAccentColorHex,
  isFontChoiceId,
  isLineHeightPreset,
  isMarginPreset,
  isSpacingPreset,
  lineHeightCeilingFor,
  marginMmFor,
  spacingStartScaleFor,
} from "./designPrefs";
import { DEFAULT_DENSITY, LINE_HEIGHT_AT_FULL_SPACING } from "./templateDensity";
import { MODERN_CURATED_ACCENTS } from "./templateMetadata";

describe("FONT_CHOICES", () => {
  it("every entry has a distinct id, a web-safe CSS stack, and a matching docx font name", () => {
    const ids = FONT_CHOICES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const font of FONT_CHOICES) {
      expect(font.fontFamily.length).toBeGreaterThan(0);
      expect(font.docxFont.length).toBeGreaterThan(0);
    }
  });

  it("isFontChoiceId/fontChoiceById round-trip for every curated font, and reject anything else", () => {
    for (const font of FONT_CHOICES) {
      expect(isFontChoiceId(font.id)).toBe(true);
      expect(fontChoiceById(font.id)).toEqual(font);
    }
    expect(isFontChoiceId("comic_sans")).toBe(false);
    expect(fontChoiceById(null)).toBeNull();
    expect(fontChoiceById(undefined)).toBeNull();
  });
});

describe("ACCENT_SWATCHES", () => {
  it("reuses the same curated palette the modern template's accent picker already uses", () => {
    expect(ACCENT_SWATCHES).toBe(MODERN_CURATED_ACCENTS);
  });

  it("isAccentColorHex accepts every swatch hex and rejects an arbitrary hex", () => {
    for (const swatch of ACCENT_SWATCHES) {
      expect(isAccentColorHex(swatch.hex)).toBe(true);
    }
    expect(isAccentColorHex("#ff00ff")).toBe(false);
    expect(isAccentColorHex(null)).toBe(false);
  });
});

describe("preset validators", () => {
  it("accept every value in their own preset list and reject anything else", () => {
    for (const p of ["compact", "standard", "spacious"] as const) {
      expect(isMarginPreset(p)).toBe(true);
      expect(isSpacingPreset(p)).toBe(true);
    }
    for (const p of ["compact", "standard", "relaxed"] as const) {
      expect(isLineHeightPreset(p)).toBe(true);
    }
    expect(isMarginPreset("huge")).toBe(false);
    expect(isSpacingPreset(undefined)).toBe(false);
    expect(isLineHeightPreset(42)).toBe(false);
  });
});

describe("preset -> render-value mappings default to today's unchanged behaviour", () => {
  it("marginMmFor defaults to the existing hardcoded PAGE_MARGIN_MM (13mm) when unset", () => {
    expect(marginMmFor({ marginPreset: null })).toBe(13);
    expect(marginMmFor({ marginPreset: "standard" })).toBe(MARGIN_MM.standard);
  });

  it("spacingStartScaleFor defaults to DEFAULT_DENSITY.spacingScale (1) when unset", () => {
    expect(spacingStartScaleFor({ spacingPreset: null })).toBe(DEFAULT_DENSITY.spacingScale);
    expect(spacingStartScaleFor({ spacingPreset: "standard" })).toBe(SPACING_START_SCALE.standard);
  });

  it("lineHeightCeilingFor defaults to the existing LINE_HEIGHT_AT_FULL_SPACING (1.2) when unset", () => {
    expect(lineHeightCeilingFor({ lineHeightPreset: null })).toBe(LINE_HEIGHT_AT_FULL_SPACING);
    expect(lineHeightCeilingFor({ lineHeightPreset: "standard" })).toBe(LINE_HEIGHT_CEILING.standard);
  });

  it("a non-standard preset moves away from the default in the expected direction", () => {
    expect(marginMmFor({ marginPreset: "compact" })).toBeLessThan(marginMmFor({ marginPreset: "standard" }));
    expect(marginMmFor({ marginPreset: "spacious" })).toBeGreaterThan(marginMmFor({ marginPreset: "standard" }));
    expect(spacingStartScaleFor({ spacingPreset: "compact" })).toBeLessThan(1);
    expect(spacingStartScaleFor({ spacingPreset: "spacious" })).toBeGreaterThan(1);
    expect(lineHeightCeilingFor({ lineHeightPreset: "compact" })).toBeLessThan(LINE_HEIGHT_AT_FULL_SPACING);
    expect(lineHeightCeilingFor({ lineHeightPreset: "relaxed" })).toBeGreaterThan(LINE_HEIGHT_AT_FULL_SPACING);
  });
});

describe("DEFAULT_DESIGN_PREFS", () => {
  it("every field is null - an unset resume defers entirely to the template's own defaults", () => {
    expect(DEFAULT_DESIGN_PREFS).toEqual({
      accentColor: null,
      fontChoice: null,
      marginPreset: null,
      spacingPreset: null,
      lineHeightPreset: null,
    });
  });
});
