import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/aiGateway/gateway", () => ({ callGateway: vi.fn(), anthropic: {} }));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: vi.fn() }));
import { parseCombinedScore, ScoreResumeCombinedError } from "./scoreResumeCombined";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { analyzeResume } from "@/lib/resume/contentChecks";

const resume = sanitizeResumeContent({ summary: "Analyst." });
const findings = analyzeResume(resume);
const valid = { ats: { score: 0, missing_keywords: [] }, content: { impact: 70, clarity: 75, issues: [] } };
describe("combined comparison validation", () => {
  it.each([null, {}, [], { ats: {} }, { ...valid, ats: { missing_keywords: [] } },
    { ...valid, ats: { score: "0", missing_keywords: [] } }, { ...valid, ats: { score: 101, missing_keywords: [] } },
    { ...valid, ats: { score: 70 } }, { ...valid, ats: { score: 70, missing_keywords: [null] } },
    { ...valid, content: { clarity: 70, issues: [] } }])("rejects incomplete or malformed assessments: %j", (value) => {
    expect(() => parseCombinedScore(value, resume, findings)).toThrow(ScoreResumeCombinedError);
  });
  it("preserves an assessed zero, and cleans duplicate keyword terms", () => {
    expect(parseCombinedScore(valid, resume, findings).ats).toEqual({ score: 0, missing_keywords: [] });
    expect(parseCombinedScore({ ...valid, ats: { score: 65, missing_keywords: [" SQL ", "SQL"] } }, resume, findings).ats).toEqual({ score: 65, missing_keywords: ["SQL"] });
  });
});
