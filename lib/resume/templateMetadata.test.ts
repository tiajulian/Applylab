import { describe, it, expect } from "vitest";
import {
  CANONICAL_TEMPLATES,
  CANONICAL_TEMPLATE_LIST,
  DEFAULT_TEMPLATE,
  TEMPLATE_METADATA,
  canonicalTemplate,
  isValidTemplate,
} from "./templateMetadata";

describe("templateMetadata", () => {
  it("defines exactly 8 canonical templates", () => {
    expect(CANONICAL_TEMPLATES).toHaveLength(8);
    expect(CANONICAL_TEMPLATE_LIST).toHaveLength(8);
  });

  it("marks exactly one template as recommended (clean)", () => {
    const recommended = CANONICAL_TEMPLATE_LIST.filter((t) => t.isRecommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe("clean");
    expect(DEFAULT_TEMPLATE).toBe("clean");
  });

  it("ensures all 8 templates are free tier and ATS safe", () => {
    CANONICAL_TEMPLATE_LIST.forEach((template) => {
      expect(template.isAtsSafe).toBe(true);
      expect(template.tier).toBe("free");
      expect(template.proOnly).toBe(false);
      expect(template.tokens).toBeDefined();
      expect(template.tokens.fontFamily).toBeTruthy();
    });
  });

  it("canonicalTemplate resolves legacy aliases and valid IDs", () => {
    expect(canonicalTemplate("ats-safe")).toBe("clean");
    expect(canonicalTemplate("design-forward")).toBe("modern");
    expect(canonicalTemplate("clean")).toBe("clean");
    expect(canonicalTemplate("technical")).toBe("technical");
    expect(canonicalTemplate("classic")).toBe("classic");
    expect(canonicalTemplate("unknown_id")).toBe("clean");
    expect(canonicalTemplate(null)).toBe("clean");
    expect(canonicalTemplate(undefined)).toBe("clean");
  });

  it("isValidTemplate validates canonical and legacy templates", () => {
    expect(isValidTemplate("clean")).toBe(true);
    expect(isValidTemplate("classic")).toBe(true);
    expect(isValidTemplate("modern")).toBe(true);
    expect(isValidTemplate("compact")).toBe(true);
    expect(isValidTemplate("editorial")).toBe(true);
    expect(isValidTemplate("technical")).toBe(true);
    expect(isValidTemplate("executive")).toBe(true);
    expect(isValidTemplate("minimal")).toBe(true);
    expect(isValidTemplate("ats-safe")).toBe(true);
    expect(isValidTemplate("design-forward")).toBe(true);
    expect(isValidTemplate("super-custom")).toBe(false);
    expect(isValidTemplate(123)).toBe(false);
  });
});
