import { describe, it, expect } from "vitest";
import {
  calculateWpm,
  evaluatePacing,
  evaluateDuration,
  OPTIMAL_WPM_MIN,
  OPTIMAL_WPM_MAX,
} from "./metrics";

describe("Interview delivery metrics", () => {
  describe("calculateWpm", () => {
    it("returns 0 for empty or invalid inputs", () => {
      expect(calculateWpm("", 60)).toBe(0);
      expect(calculateWpm("   ", 60)).toBe(0);
      expect(calculateWpm("hello world", 0)).toBe(0);
      expect(calculateWpm("hello world", -5)).toBe(0);
    });

    it("calculates accurate WPM for typical speech samples", () => {
      // 140 words in 60 seconds = 140 WPM
      const words140 = Array(140).fill("word").join(" ");
      expect(calculateWpm(words140, 60)).toBe(140);

      // 70 words in 30 seconds = 140 WPM
      const words70 = Array(70).fill("word").join(" ");
      expect(calculateWpm(words70, 30)).toBe(140);

      // 150 words in 90 seconds = 100 WPM
      const words150 = Array(150).fill("word").join(" ");
      expect(calculateWpm(words150, 90)).toBe(100);
    });
  });

  describe("evaluatePacing", () => {
    it("flags pacing below optimal range", () => {
      const slow = evaluatePacing(OPTIMAL_WPM_MIN - 15);
      expect(slow.rating).toBe("too_slow");
      expect(slow.feedback).toContain("slow");
    });

    it("approves pacing within optimal range", () => {
      const good = evaluatePacing(145);
      expect(good.rating).toBe("good");
      expect(good.feedback).toContain("Solid");
    });

    it("flags pacing above optimal range", () => {
      const fast = evaluatePacing(OPTIMAL_WPM_MAX + 20);
      expect(fast.rating).toBe("too_fast");
      expect(fast.feedback).toContain("fast");
    });

    it("handles zero WPM gracefully", () => {
      const zero = evaluatePacing(0);
      expect(zero.rating).toBe("good");
      expect(zero.feedback).toContain("text");
    });
  });

  describe("evaluateDuration", () => {
    it("flags answers running excessively long (> 150s)", () => {
      const long = evaluateDuration(180);
      expect(long.isOverLimit).toBe(true);
      expect(long.feedback).toContain("ran long");
    });

    it("approves standard duration (30s - 150s)", () => {
      const normal = evaluateDuration(95);
      expect(normal.isOverLimit).toBe(false);
      expect(normal.feedback).toContain("Good duration");
    });

    it("notes very brief answers (< 30s)", () => {
      const brief = evaluateDuration(20);
      expect(brief.isOverLimit).toBe(false);
      expect(brief.feedback).toContain("brief");
    });
  });
});
