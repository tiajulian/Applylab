import { describe, expect, it } from "vitest";
import { canCreateLetter, canUseFeature, lockedFeatures, remainingLetters } from "@/lib/coverLetter/entitlements";
import { COVER_LETTER_LIMITS } from "@/lib/coverLetter/config";

describe("cover letter entitlements", () => {
  it("caps free accounts at the configured number of letters", () => {
    expect(remainingLetters("free", 0)).toBe(COVER_LETTER_LIMITS.freeLetters);
    expect(canCreateLetter("free", 0)).toBe(true);
    expect(canCreateLetter("free", COVER_LETTER_LIMITS.freeLetters)).toBe(false);
    expect(remainingLetters("free", 99)).toBe(0);
  });

  it("never caps paid accounts", () => {
    expect(remainingLetters("pro", 500)).toBeNull();
    expect(canCreateLetter("pro", 500)).toBe(true);
  });

  it("locks rewrite and export features for free only", () => {
    expect(canUseFeature("free", "coverLetter.create")).toBe(true);
    expect(canUseFeature("free", "coverLetter.export")).toBe(false);
    expect(canUseFeature("pro", "coverLetter.export")).toBe(true);
    expect(lockedFeatures("pro")).toEqual([]);
    expect(lockedFeatures("free")).toContain("coverLetter.aiRewrite");
  });
});
