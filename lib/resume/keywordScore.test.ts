import { describe, expect, it } from "vitest";
import { keywordContentKey, isContentScoreBreakdown, isKeywordScore } from "./keywordScore";
import { keywordScoreHash } from "./keywordScoreHash";
import { resumeScoreHash } from "./resumeScoreHash";
import { sanitizeResumeContent } from "./sanitizeResumeContent";

describe("keyword score identity", () => {
  it("requires all writing-score categories before accepting a cached comparison", () => {
    expect(isContentScoreBreakdown({ impact: 70, clarity: 80, brevity: 90, completeness: 60 })).toBe(true);
    for (const value of [{}, null, [], { impact: 70 }, { impact: "70", clarity: 80, brevity: 90, completeness: 60 }]) expect(isContentScoreBreakdown(value)).toBe(false);
  });
  const content = sanitizeResumeContent({ summary: "Reporting analyst." });
  it("invalidates the old permissive scoring cache", () => {
    expect(keywordScoreHash(content, "ad")).not.toBe(resumeScoreHash(content, "ad"));
    expect(keywordScoreHash(content, "ad")).not.toBe(keywordScoreHash(content, "different ad"));
  });
  it("ignores layout order but recognises edits and identical-number re-scores", () => {
    expect(keywordContentKey({ ...content, section_order: ["skills", "experience"] })).toBe(keywordContentKey(content));
    expect(keywordScoreHash({ ...content, section_order: ["skills", "experience"] }, "ad")).toBe(keywordScoreHash(content, "ad"));
    expect(keywordContentKey({ ...content, summary: "Changed." })).not.toBe(keywordContentKey(content));
  });
  it("accepts a real zero while rejecting parser defaults and invalid values", () => {
    expect(isKeywordScore(0)).toBe(true);
    for (const value of [null, undefined, "0", NaN, Infinity, -1, 101]) expect(isKeywordScore(value)).toBe(false);
  });
});
