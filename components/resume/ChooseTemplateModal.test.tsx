import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChooseTemplateModal } from "./ChooseTemplateModal";
import { TemplatePicker } from "./TemplatePicker";
import { CANONICAL_TEMPLATES } from "@/lib/resume/templateMetadata";

describe("ChooseTemplateModal & TemplatePicker Component Rendering", () => {
  it("renders ChooseTemplateModal with all 8 templates and miniature previews", () => {
    const markup = renderToStaticMarkup(
      createElement(ChooseTemplateModal, {
        isOpen: true,
        selectedTemplate: "clean",
        onSelect: () => {},
        onClose: () => {},
      })
    );

    // Verify dialog title
    expect(markup).toContain("Choose your template");

    // Verify all 8 templates are in the document
    CANONICAL_TEMPLATES.forEach((id) => {
      // Capitalized name in markup
      const name = id.charAt(0).toUpperCase() + id.slice(1);
      expect(markup).toContain(name);
    });

    // Verify miniature previews contain candidate name and section landmarks
    expect(markup).toContain("Alex Morgan");
    expect(markup).toContain("SUMMARY");
    expect(markup).toContain("EXPERIENCE");
  });

  it("renders Modern curated accent color swatches when Modern template is active", () => {
    const markup = renderToStaticMarkup(
      createElement(ChooseTemplateModal, {
        isOpen: true,
        selectedTemplate: "modern",
        selectedAccentColor: "#14532d",
        onSelect: () => {},
        onClose: () => {},
      })
    );

    expect(markup).toContain("Modern Accent Color:");
    expect(markup).toContain("Forest Green");
    expect(markup).toContain("bg-blue-900");
    expect(markup).toContain("bg-emerald-900");
    expect(markup).toContain("bg-rose-900");
    expect(markup).toContain("bg-slate-700");
  });

  it("returns null when ChooseTemplateModal isOpen is false", () => {
    const markup = renderToStaticMarkup(
      createElement(ChooseTemplateModal, {
        isOpen: false,
        selectedTemplate: "clean",
        onSelect: () => {},
        onClose: () => {},
      })
    );

    expect(markup).toBe("");
  });

  it("renders TemplatePicker with all 8 template cards", () => {
    const markup = renderToStaticMarkup(
      createElement(TemplatePicker, {
        selected: "clean",
        onSelect: () => {},
      })
    );

    CANONICAL_TEMPLATES.forEach((id) => {
      const name = id.charAt(0).toUpperCase() + id.slice(1);
      expect(markup).toContain(name);
    });

    expect(markup).toContain("Active");
    expect(markup).toContain("Apply");
    expect(markup).toContain("Recommended");
  });
});
