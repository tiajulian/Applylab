import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CleanTemplate,
  ClassicTemplate,
  ModernTemplate,
  CompactTemplate,
  EditorialTemplate,
  TechnicalTemplate,
  ExecutiveTemplate,
  MinimalTemplate,
  getTemplateDefinition,
} from "@/lib/resume/templateRegistry";
import { CANONICAL_TEMPLATES } from "@/lib/resume/templateMetadata";
import type { ResumeContent } from "@/types";

const TEST_RESUME: ResumeContent = {
  contact: {
    name: "Alex Morgan",
    phone: "0400 123 456",
    email: "alex.morgan@example.com",
    location: "Sydney, NSW",
    linkedin: "linkedin.com/in/alexmorgan",
    work_rights: "Australian Citizen",
  },
  target_titles: ["Lead Data Engineer", "Senior Analytics Engineer"],
  summary: "Accomplished data engineer with 8+ years building high-throughput pipelines and data platforms.",
  skills: ["TypeScript", "Python", "SQL", "Data Modelling", "System Design", "Cloud Infrastructure"],
  tools: ["Databases: Snowflake, PostgreSQL", "Cloud & DevOps: AWS, Docker, Terraform"],
  projects: [
    {
      title: "Real-time Telemetry Pipeline",
      context: "Open Source",
      year: "2024",
      bullets: ["Ingested 10M events/day using Kafka and ClickHouse."],
    },
  ],
  experience: [
    {
      job_title: "Staff Data Engineer",
      company: "Dataflow Tech",
      location: "Sydney, NSW",
      start_date: "June 2022",
      end_date: "Present",
      company_description: "",
      bullets: [
        "Architected scalable ingestion framework reducing cluster costs by 40%.",
        "Mentored team of 6 engineers on streaming pipeline best practices.",
      ],
    },
    {
      job_title: "Senior Analytics Engineer",
      company: "Metrics Cloud",
      location: "Melbourne, VIC",
      start_date: "March 2019",
      end_date: "May 2022",
      company_description: "",
      bullets: ["Developed dbt models and semantic metrics layer used by 200+ internal stakeholders."],
    },
  ],
  education: [
    {
      degree: "Bachelor of Computer Science",
      institution: "University of Sydney",
      year: "2015 - 2018",
      notes: "First Class Honours",
    },
  ],
  referees: [
    {
      name: "Jordan Lee",
      title: "VP of Engineering",
      organisation: "Dataflow Tech",
      phone: "0400 999 888",
      email: "jordan@dataflow.com",
    },
  ],
};


describe("ATS Resume Templates Parse & Structural Integrity", () => {
  it("renders all 8 canonical templates to static HTML without runtime errors", () => {
    CANONICAL_TEMPLATES.forEach((templateId) => {
      const def = getTemplateDefinition(templateId);
      expect(def).toBeDefined();
      const markup = renderToStaticMarkup(
        createElement(def.component, { resume: TEST_RESUME })
      );
      expect(markup).toBeTruthy();
      expect(markup).toContain("Alex Morgan");
      expect(markup).toContain("alex.morgan@example.com");
      expect(markup).toContain("Staff Data Engineer");
    });
  });

  it("strictly enforces ATS single-column rules (no table or iframe elements)", () => {
    CANONICAL_TEMPLATES.forEach((templateId) => {
      const def = getTemplateDefinition(templateId);
      const markup = renderToStaticMarkup(
        createElement(def.component, { resume: TEST_RESUME })
      );
      expect(markup).not.toContain("<table");
      expect(markup).not.toContain("<iframe");
      expect(markup).not.toContain("<frameset");
    });
  });

  it("Technical template promotes Skills & Tools ABOVE Experience with ISO dates", () => {
    const markup = renderToStaticMarkup(
      createElement(TechnicalTemplate, { resume: TEST_RESUME })
    );

    // Verify // prefix for monospace section headings
    expect(markup).toContain("// Skills &amp; Core Competencies");
    expect(markup).toContain("// Professional Experience");

    // Verify section order: Skills appears before Experience in the HTML stream
    const skillsPos = markup.indexOf("// Skills &amp; Core Competencies");
    const expPos = markup.indexOf("// Professional Experience");
    expect(skillsPos).toBeGreaterThan(-1);
    expect(expPos).toBeGreaterThan(-1);
    expect(skillsPos).toBeLessThan(expPos);

    // Verify ISO date conversion (June 2022 -> 2022-06, March 2019 -> 2019-03, May 2022 -> 2022-05)
    expect(markup).toContain("2022-06 - Present");
    expect(markup).toContain("2019-03 - 2022-05");
  });

  it("Executive template uses Profile and Capabilities section names with no rules", () => {
    const markup = renderToStaticMarkup(
      createElement(ExecutiveTemplate, { resume: TEST_RESUME })
    );

    expect(markup).toContain("Profile</h2>");
    expect(markup).toContain("Capabilities</h2>");
    expect(markup).not.toContain("Professional Summary</h2>");
    expect(markup).not.toContain("1px solid #1a1a1a");
  });

  it("Classic template centers header and renders location on a subline", () => {
    const markup = renderToStaticMarkup(
      createElement(ClassicTemplate, { resume: TEST_RESUME })
    );

    expect(markup).toContain("text-align:center");
    expect(markup).toContain("font-style:italic");
    expect(markup).toContain("Sydney, NSW</p>");
  });

  it("Modern template applies custom accent color to headings and name", () => {
    const markup = renderToStaticMarkup(
      createElement(ModernTemplate, {
        resume: TEST_RESUME,
        accentColor: "#14532d", // Forest Green
      })
    );

    // Headings colored with accent and unruled
    expect(markup).toContain("color:#14532d");
    expect(markup).toContain("border-bottom:none");
    expect(markup).toContain("border-bottom:2px solid #14532d");
  });

  it("Minimal template uses sentence-case un-tracked headings", () => {
    const markup = renderToStaticMarkup(
      createElement(MinimalTemplate, { resume: TEST_RESUME })
    );

    expect(markup).toContain("Professional Summary</h2>");
    expect(markup).toContain("text-transform:none");
    expect(markup).toContain("border-bottom:none");
  });

  it("Clean template uses uppercase caps with full-width black divider rule", () => {
    const markup = renderToStaticMarkup(
      createElement(CleanTemplate, { resume: TEST_RESUME })
    );

    expect(markup).toContain("text-transform:uppercase");
    expect(markup).toContain("border-bottom:1px solid #1a1a1a");
  });

  it("Compact template renders without divider rules for high-density space efficiency", () => {
    const markup = renderToStaticMarkup(
      createElement(CompactTemplate, { resume: TEST_RESUME })
    );

    expect(markup).toContain("border-bottom:none");
  });

  it("Editorial template pairs Georgia role titles with quiet grey section labels", () => {
    const markup = renderToStaticMarkup(
      createElement(EditorialTemplate, { resume: TEST_RESUME })
    );

    expect(markup).toContain("color:#64748b");
    expect(markup).toContain("font-family:Georgia, &#x27;Times New Roman&#x27;, Times, serif");
  });
});
