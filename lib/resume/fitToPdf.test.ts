import { describe, expect, it } from "vitest";
import { pickFittedLadderIndex } from "./fitToPdf";

describe("pickFittedLadderIndex (same rule as lib/pdf/pageFit.ts)", () => {
  it("picks the first state that fits one page", () => {
    expect(pickFittedLadderIndex([2, 2, 1, 1])).toBe(2);
    expect(pickFittedLadderIndex([1, 1])).toBe(0);
  });

  it("falls back to the least aggressive state within two pages", () => {
    expect(pickFittedLadderIndex([3, 2, 2])).toBe(1);
  });

  it("falls back to the last state when nothing reaches the ceiling", () => {
    expect(pickFittedLadderIndex([4, 3, 3])).toBe(2);
  });

  it("handles an empty ladder", () => {
    expect(pickFittedLadderIndex([])).toBe(0);
  });
});
