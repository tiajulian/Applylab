import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionAccordion } from "./SectionAccordion";
import { BulletEditor } from "./BulletEditor";
import { ResumeEditorForm } from "./ResumeEditorForm";
import type { FactCheckFlag, ResumeContent } from "@/types";

const MOCK_RESUME_COMPLETE: ResumeContent = {
  contact: {
    name: "Alex Morgan",
    phone: "0400 000 000",
    email: "alex@example.com",
    location: "Sydney, NSW",
    linkedin: "linkedin.com/in/alexmorgan",
    work_rights: "Australian Citizen",
  },
  target_titles: ["Operations Manager", "Operations Coordinator"],
  summary: "Results-driven Operations Manager with 7+ years of experience leading cross-functional teams.",
  skills: ["Logistics", "Process Optimization", "Vendor Management", "Budgeting"],
  tools: ["Jira", "Excel", "SAP", "Salesforce"],
  experience: [
    {
      job_title: "Senior Operations Specialist",
      company: "Acme Corp",
      company_description: "Leading enterprise logistics provider",
      location: "Sydney, NSW",
      start_date: "2021",
      end_date: "Present",
      bullets: [
        "Reduced freight dispatch delays by 28% across 14 distribution centres by automating carrier allocation in SAP.",
      ],
    },
  ],
  projects: [
    {
      title: "Warehouse Automation",
      context: "SAP, Python",
      year: "2023",
      bullets: ["Automated inventory reconciliation saving 12 hours weekly."],
    },
  ],
  education: [
    {
      degree: "Bachelor of Business (Logistics)",
      institution: "University of Sydney",
      year: "2018",
      notes: "Dean's Honours List",
    },
  ],
  referees: [
    {
      name: "Jane Doe",
      title: "VP of Operations",
      organisation: "Acme Corp",
      phone: "0411 111 111",
      email: "jane@example.com",
    },
  ],
};

const MOCK_RESUME_INCOMPLETE_ONE: ResumeContent = {
  ...MOCK_RESUME_COMPLETE,
  target_titles: [], // 1 section missing -> 8 of 9 complete, 1 to review
};

describe("Resume Workspace Redesign - Unit Tests", () => {
  describe("SectionAccordion", () => {
    it("renders with closed state and live summary", () => {
      const markup = renderToStaticMarkup(
        createElement(
          SectionAccordion,
          {
            id: "experience",
            title: "Work Experience",
            summary: "3 roles · 9 bullets",
            isOpen: false,
            pipState: "done",
            onToggle: () => {},
          },
          createElement("div", null, "Inner content")
        )
      );

      expect(markup).toContain("Work Experience");
      expect(markup).toContain("3 roles · 9 bullets");
      expect(markup).toContain('aria-expanded="false"');
    });

    it("renders flagged pip when pipState is flagged", () => {
      const markup = renderToStaticMarkup(
        createElement(
          SectionAccordion,
          {
            id: "contact",
            title: "Contact",
            summary: "alex@example.com",
            isOpen: true,
            pipState: "flagged",
            onToggle: () => {},
          },
          createElement("div", null, "Contact inputs")
        )
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

    it("renders with amber pulse highlight and explanatory tooltip when isHighlighted is true", () => {
      const markup = renderToStaticMarkup(
        createElement(BulletEditor, {
          id: "experience-bullet-0-0",
          isHighlighted: true,
          tooltipMessage: "Bullet missing metric",
          resumeId: "test-resume",
          value: "Handled customer inquiries.",
          onChange: () => {},
          onRemove: () => {},
        })
      );

      expect(markup).toContain("animate-pulse-amber");
      expect(markup).toContain("Bullet missing metric");
      expect(markup).toContain('id="experience-bullet-0-0"');
    });
  });

  describe("ResumeEditorForm Status Indicator Badge", () => {
    it("renders interactive badge [ 8 of 9 complete • 1 to review ⚠️ ] when 1 section is missing", () => {
      const markup = renderToStaticMarkup(
        createElement(ResumeEditorForm, {
          resumeId: "test-resume",
          resume: MOCK_RESUME_INCOMPLETE_ONE,
          onChange: () => {},
        })
      );

      // Verify interactive badge with 8 of 9 complete and 1 to review ⚠️
      expect(markup).toContain("8 of 9 complete");
      expect(markup).toContain("1 to review");
      expect(markup).toContain("⚠️");
      expect(markup).toContain('aria-label="Status: 8 of 9 complete, 1 to review. Click to jump to problem."');
    });

    it("renders complete status badge when all 9 sections are complete", () => {
      const markup = renderToStaticMarkup(
        createElement(ResumeEditorForm, {
          resumeId: "test-resume",
          resume: MOCK_RESUME_COMPLETE,
          onChange: () => {},
        })
      );

      expect(markup).toContain("9 of 9 complete");
      expect(markup).toContain("Complete");
      expect(markup).not.toContain("to review");
    });

    it("renders review badge when fact check flags are present", () => {
      const mockFlag: FactCheckFlag = {
        severity: "high",
        location: "Work experience #1",
        message: "Bullet missing metric",
        value: "Managed logistics operations",
        target: { kind: "experienceBullet", index: 0, bulletIndex: 0 },
      };

      const markup = renderToStaticMarkup(
        createElement(ResumeEditorForm, {
          resumeId: "test-resume",
          resume: MOCK_RESUME_COMPLETE,
          flags: [mockFlag],
          onChange: () => {},
        })
      );

      expect(markup).toContain("1 to review");
      expect(markup).toContain("⚠️");
      expect(markup).toContain('id="experience-bullet-0-0"');
    });
  });
});
