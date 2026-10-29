import { describe, expect, it } from "vitest";
import { withReviewSpelling } from "./reviewSpelling";
import type { ResumeContent } from "@/types";

const content: ResumeContent = {
  contact: { name: "Sam Lee", email: "", phone: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "I recieved useful feedback.", skills: [], tools: [], education: [], referees: [], projects: [], experience: [],
};

describe("review spelling", () => {
  it("offers a whole-field correction using the existing Australian dictionary", async () => {
    const findings = await withReviewSpelling(content, []);
    expect(findings).toHaveLength(1);
    expect(findings[0].replacement).toBe("I received useful feedback.");
    expect(findings[0].target).toEqual({ kind: "summary" });
    expect(findings[0].bullet_text).toBe(content.summary);
  });
  it("does not recreate dismissed suggestions or lose saved undo information", async () => {
    const [finding] = await withReviewSpelling(content, []);
    const saved = { ...finding, status: "dismissed" as const };
    expect(await withReviewSpelling(content, [saved])).toEqual([saved]);
    const corrected = { ...content, summary: finding.replacement! };
    const applied = { ...finding, status: "applied" as const, review_change: { blockId: "summary", before: content.summary, after: corrected.summary } };
    expect(await withReviewSpelling(corrected, [applied])).toEqual([applied]);
  });
  it("removes obsolete open spelling findings after editing", async () => {
    const findings = await withReviewSpelling(content, []);
    expect(await withReviewSpelling({ ...content, summary: "I organise events at the centre." }, findings)).toEqual([]);
  });
});
