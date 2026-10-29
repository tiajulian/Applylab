import { describe, expect, it } from "vitest";
import { reviewStrengths, topReviewFindings } from "./reviewHighlights";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

const finding = (id: string, overrides: Partial<ResumeReviewFinding> = {}): ResumeReviewFinding => ({ id, category_key: "writing_quality", severity: "info", title: id, status: "open", ...overrides });

describe("review highlights", () => {
  it("selects up to three open suggestions, prioritising serious issues and simple fixes", () => {
    const top = topReviewFindings([
      finding("info"), finding("warning", { severity: "warning" }), finding("urgent", { severity: "hard_fail" }),
      finding("quick", { replacement: "Corrected wording." }), finding("applied", { severity: "hard_fail", status: "applied" }),
      finding("dismissed", { severity: "hard_fail", status: "dismissed" }),
    ]);
    expect(top.map((f) => f.id)).toEqual(["urgent", "warning", "quick"]);
  });
  it("does not fill the shortlist with several issues in the same field", () => {
    const target = { kind: "summary" as const };
    expect(topReviewFindings([finding("a", { target }), finding("b", { target }), finding("c")]).map((f) => f.id)).toEqual(["a", "c"]);
  });
  it("reports only strengths visible in the supplied content", () => {
    const resume: ResumeContent = {
      contact: { name: "Sam Lee", email: "sam@example.com", phone: "0400000000", location: "", linkedin: "", work_rights: "" },
      target_titles: [], summary: "", skills: ["SQL"], tools: [], projects: [], experience: [], education: [], referees: [],
    };
    expect(reviewStrengths(resume)).toEqual(["Your name, email and phone number are included.", "You have a dedicated list of skills."]);
    expect(reviewStrengths({ ...resume, contact: { ...resume.contact, email: "" }, skills: [] })).toEqual([]);
  });
});
