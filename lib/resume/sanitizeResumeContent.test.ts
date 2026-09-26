import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sanitizeLinkedinUrl, sanitizePhoneNumber, sanitizeResumeContent } from "./sanitizeResumeContent";
import { ATSSafeTemplate } from "@/components/templates/ATSSafeTemplate";

// Regression: resume_content is stored as jsonb. A row written before target_titles/tools/
// projects existed on ResumeContent simply doesn't have those keys - the TS type says they're
// required, but nothing enforces that against what's actually in the database. Every read site
// that hands resume_content to a template/export/scoring function must run it through this
// first, or `.target_titles.length` / `.tools.map` / `.projects.length` on an old row throws
// "Cannot read properties of undefined", which is exactly the client-side exception this guards.
const PRE_MIGRATION_RESUME_CONTENT = {
  contact: { name: "Jamie Citizen", phone: "0400 000 000", email: "jamie@example.com", location: "Sydney, NSW", linkedin: "", work_rights: "Australian citizen" },
  summary: "Business Analyst with 5 years of experience.",
  // Old shape: category-labelled strings, no separate "tools" field at all.
  skills: ["Data analysis and querying: SQL, Excel"],
  experience: [
    {
      job_title: "Business Analyst",
      company: "Woolworths Group",
      company_description: "",
      location: "Sydney, NSW",
      start_date: "2022",
      end_date: "Present",
      bullets: ["Cut reporting time by 30% through process improvements."],
    },
  ],
  education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
  referees: [],
  // No target_titles, no tools, no projects keys at all - this is the actual shape of any
  // resume_content saved before those fields existed.
};

describe("sanitizeResumeContent", () => {
  it("fills target_titles/tools/projects with empty arrays for a pre-migration resume_content", () => {
    const result = sanitizeResumeContent(PRE_MIGRATION_RESUME_CONTENT);
    expect(result.target_titles).toEqual([]);
    expect(result.tools).toEqual([]);
    expect(result.projects).toEqual([]);
    // Rendering code calls .length/.map on these unconditionally - prove that's now safe.
    expect(() => result.target_titles.length).not.toThrow();
    expect(() => result.tools.map((t) => t)).not.toThrow();
    expect(() => result.projects.length).not.toThrow();
  });

  it("preserves the pre-existing fields unchanged", () => {
    const result = sanitizeResumeContent(PRE_MIGRATION_RESUME_CONTENT);
    expect(result.contact.name).toBe("Jamie Citizen");
    expect(result.summary).toBe("Business Analyst with 5 years of experience.");
    expect(result.skills).toEqual(["Data analysis and querying: SQL, Excel"]);
    expect(result.experience).toHaveLength(1);
    expect(result.experience[0].job_title).toBe("Business Analyst");
    expect(result.education).toHaveLength(1);
  });

  it("passes through a current-shape resume_content unchanged", () => {
    const current = {
      contact: { name: "Jamie", phone: "0400 000 000", email: "", location: "", linkedin: "linkedin.com/in/jamie", work_rights: "" },
      target_titles: ["Business Analyst", "Data Analyst"],
      summary: "",
      skills: ["Stakeholder reporting"],
      tools: ["Data analysis and querying: SQL, Excel"],
      experience: [],
      projects: [{ title: "Side project", context: "Freelance", year: "2023", bullets: ["Built a thing."] }],
      education: [],
      referees: [],
    };
    expect(sanitizeResumeContent(current)).toEqual(current);
  });

  it("handles null/undefined/non-object input without throwing", () => {
    expect(() => sanitizeResumeContent(null)).not.toThrow();
    expect(() => sanitizeResumeContent(undefined)).not.toThrow();
    expect(() => sanitizeResumeContent("not an object")).not.toThrow();
    expect(sanitizeResumeContent(null).target_titles).toEqual([]);
  });

  it("drops non-string entries from array fields instead of keeping them", () => {
    const result = sanitizeResumeContent({ ...PRE_MIGRATION_RESUME_CONTENT, target_titles: ["Real title", 42, null] });
    expect(result.target_titles).toEqual(["Real title"]);
  });

  it("reproduces the actual crash: rendering an unsanitized pre-migration object throws", () => {
    // This is the exact failure a user saw as a blank "Application error" page: the template
    // calls .length on target_titles unconditionally, which is undefined on old rows.
    expect(() =>
      renderToStaticMarkup(
        createElement(ATSSafeTemplate, { resume: PRE_MIGRATION_RESUME_CONTENT as never })
      )
    ).toThrow();
  });

  it("fixes the crash: the same object renders fine once sanitized first", () => {
    const sanitized = sanitizeResumeContent(PRE_MIGRATION_RESUME_CONTENT);
    let markup = "";
    expect(() => {
      markup = renderToStaticMarkup(createElement(ATSSafeTemplate, { resume: sanitized }));
    }).not.toThrow();
    expect(markup).toContain("Jamie Citizen");
  });
});

describe("sanitizeResumeContent drops fully-blank repeatable entries (regression: a resume showed an empty, orphaned duplicate role next to the real one)", () => {
  it("drops an experience entry with every field blank and no bullets, keeping a real one right next to it", () => {
    const result = sanitizeResumeContent({
      ...PRE_MIGRATION_RESUME_CONTENT,
      experience: [
        { job_title: "", company: "", company_description: "", location: "", start_date: "", end_date: "", bullets: [] },
        { job_title: "Senior Analyst", company: "Acme", company_description: "", location: "Sydney", start_date: "2022", end_date: "2024", bullets: ["Did a thing."] },
      ],
    });
    expect(result.experience).toHaveLength(1);
    expect(result.experience[0].company).toBe("Acme");
  });

  it("keeps an entry that has ONLY a job_title/company typed in but nothing else yet - a user mid-way through filling in a freshly-added role", () => {
    const result = sanitizeResumeContent({
      ...PRE_MIGRATION_RESUME_CONTENT,
      experience: [{ job_title: "Senior Financial Crime Analyst", company: "Combank", company_description: "", location: "", start_date: "", end_date: "", bullets: [] }],
    });
    expect(result.experience).toHaveLength(1);
  });

  it("drops fully-blank entries the same way for education, referees, and projects", () => {
    const result = sanitizeResumeContent({
      ...PRE_MIGRATION_RESUME_CONTENT,
      education: [
        { degree: "", institution: "", year: "", notes: "" },
        { degree: "BSc", institution: "UNSW", year: "2020", notes: "" },
      ],
      referees: [
        { name: "", title: "", organisation: "", phone: "", email: "" },
        { name: "Alex Manager", title: "Lead", organisation: "Acme", phone: "0400", email: "alex@example.com" },
      ],
      projects: [
        { title: "", context: "", year: "", bullets: [] },
        { title: "Side project", context: "Personal", year: "2023", bullets: ["Built a thing."] },
      ],
    });
    expect(result.education).toHaveLength(1);
    expect(result.referees).toHaveLength(1);
    expect(result.projects).toHaveLength(1);
  });

  it("never touches an already-empty array (no entries to drop) or a fully-populated one", () => {
    const current = {
      ...PRE_MIGRATION_RESUME_CONTENT,
      education: [],
      referees: [],
    };
    const result = sanitizeResumeContent(current);
    expect(result.education).toEqual([]);
    expect(result.referees).toEqual([]);
    expect(result.experience).toHaveLength(1);
  });
});

describe("sanitizeLinkedinUrl & sanitizePhoneNumber", () => {
  it("strips tracking parameters and machine IDs from LinkedIn URLs", () => {
    expect(sanitizeLinkedinUrl("https://linkedin.com/in/john-doe-861a86182?ref=xyz")).toBe("linkedin.com/in/john-doe");
    expect(sanitizeLinkedinUrl("linkedin.com/in/john-doe/")).toBe("linkedin.com/in/john-doe");
    expect(sanitizeLinkedinUrl("in/john-doe")).toBe("linkedin.com/in/john-doe");
  });

  it("sanitizes phone numbers cleanly", () => {
    expect(sanitizePhoneNumber("+61 400 000 000")).toBe("+61 400 000 000");
    expect(sanitizePhoneNumber("0400 111 222\u200B")).toBe("0400 111 222");
  });
});
