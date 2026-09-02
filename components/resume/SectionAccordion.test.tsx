import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionAccordion } from "./SectionAccordion";
import { BulletEditor } from "./BulletEditor";

describe("Resume Workspace Redesign - Unit Tests", () => {
  describe("SectionAccordion", () => {
    it("renders with closed state and live summary", () => {
      const markup = renderToStaticMarkup(
        createElement(SectionAccordion, {
          id: "experience",
          title: "Work Experience",
          summary: "3 roles · 9 bullets",
          isOpen: false,
          pipState: "done",
          onToggle: () => {},
          children: createElement("div", null, "Inner content"),
        })
      );

      expect(markup).toContain("Work Experience");
      expect(markup).toContain("3 roles · 9 bullets");
      expect(markup).toContain('aria-expanded="false"');
    });

    it("renders flagged pip when pipState is flagged", () => {
      const markup = renderToStaticMarkup(
        createElement(SectionAccordion, {
          id: "contact",
          title: "Contact",
          summary: "alex@example.com",
          isOpen: true,
          pipState: "flagged",
          onToggle: () => {},
          children: createElement("div", null, "Contact inputs"),
        })
      );

      expect(markup).toContain("Contact");
      expect(markup).toContain("!");
      expect(markup).toContain('aria-expanded="true"');
      expect(markup).toContain("Contact inputs");
    });
  });

  describe("BulletEditor", () => {
    it("renders auto-growing textarea with improve dropdown trigger and accessible controls", () => {
      const markup = renderToStaticMarkup(
        createElement(BulletEditor, {
          resumeId: "test-resume",
          value: "Led a team of 5 engineers to deliver project ahead of schedule.",
          onChange: () => {},
          onRemove: () => {},
          onMoveUp: () => {},
          onMoveDown: () => {},
        })
      );

      expect(markup).toContain("Led a team of 5 engineers to deliver project ahead of schedule.");
      expect(markup).toContain("Improve");
      expect(markup).toContain('aria-label="Move bullet up"');
      expect(markup).toContain('aria-label="Move bullet down"');
      expect(markup).toContain('aria-label="Remove bullet"');
    });
  });
});
