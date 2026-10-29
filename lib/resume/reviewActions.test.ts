import { describe, expect, it } from "vitest";
import { blankQuestion, findingField, suggestedReplacement, undoReviewChange } from "./reviewActions";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

const content: ResumeContent = {
  contact: { name: "Sam Lee", email: "", phone: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "Experienced analyst.", skills: [], tools: [], education: [], referees: [],
  experience: [{ job_title: "Analyst", company: "Acme", company_description: "", location: "", start_date: "2022", end_date: "Present", bullets: ["Prepared reports."] }],
  projects: [{ title: "Reporting", year: "2024", context: "", bullets: ["Built a dashboard."] }],
};
const finding: ResumeReviewFinding = {
  id: "claude-finding-0-content_quality", title: "Add detail", category_key: "content_quality", severity: "warning",
  bullet_text: "Prepared reports.", fix_text: "Prepared reports for [add team].", target: { kind: "experienceBullet", index: 0, bulletIndex: 0 },
};

describe("safe review fields", () => {
  it("resolves the exact targeted bullet", () => expect(findingField(content, finding)?.text).toBe("Prepared reports."));
  it("refuses a stale target instead of overwriting a different bullet", () => {
    expect(findingField(content, { ...finding, bullet_text: "Old wording." })).toBeNull();
  });
  it("finds a unique project bullet without a pointer", () => {
    expect(findingField(content, { ...finding, target: undefined, bullet_text: "Built a dashboard." })?.id).toBe("projectBullet:0:0");
  });
  it("refuses ambiguous text matches and composite date fields", () => {
    expect(findingField({ ...content, experience: [content.experience[0], content.experience[0]] }, { ...finding, target: undefined })).toBeNull();
    expect(findingField(content, { ...finding, target: { kind: "experienceHeader", index: 0, field: "dates" } })).toBeNull();
  });
  it("allows an empty summary to be filled in", () => {
    expect(findingField({ ...content, summary: "" }, { ...finding, bullet_text: undefined, target: { kind: "summary" } })?.text).toBe("");
  });
  it("distinguishes advice from a replacement", () => {
    expect(suggestedReplacement({ ...finding, id: "integrity-company-missing-0", fix_text: "Add the employer's name." })).toBeNull();
    expect(suggestedReplacement({ ...finding, replacement: "Prepared weekly reports." })).toBe("Prepared weekly reports.");
    expect(suggestedReplacement(finding)).toBe(finding.fix_text);
  });
  it("undoes only the unchanged field and preserves unrelated edits", () => {
    const next = undoReviewChange({ ...content, summary: "Another edit." }, {
      ...finding, review_change: { blockId: "experienceBullet:0:0", before: "Original report wording.", after: "Prepared reports." },
    });
    expect(next?.summary).toBe("Another edit.");
    expect(next?.experience[0].bullets[0]).toBe("Original report wording.");
    expect(content.experience[0].bullets[0]).toBe("Prepared reports.");
    expect(undoReviewChange(content, { ...finding, review_change: { blockId: "experienceBullet:0:0", before: "Old.", after: "Different." } })).toBeNull();
  });
  it("asks for facts without requiring invented metrics", () => {
    expect(blankQuestion("[add tool]")).toContain("tool or system");
    expect(blankQuestion("[add result]")).toContain("number is optional");
  });
});
