import { describe, expect, it } from "vitest";
import { pickFittedLadderIndex } from "./fitToPdf";

describe("pickFittedLadderIndex (same rule as lib/pdf/pageFit.ts)", () => {
  it("picks the first state that fits one page", () => {
    expect(pickFittedLadderIndex([2, 2, 1, 1])).toBe(2);
    expect(pickFittedLadderIndex([1, 1])).toBe(0);
  });

  it("otherwise picks the least aggressive state with the fewest pages", () => {
    expect(pickFittedLadderIndex([3, 2, 2])).toBe(1);
    expect(pickFittedLadderIndex([4, 3, 3])).toBe(1);
  });

  it("keeps the user's own layout when no tighter state saves a page", () => {
    expect(pickFittedLadderIndex([3, 3, 3])).toBe(0);
  });

  it("handles an empty ladder", () => {
    expect(pickFittedLadderIndex([])).toBe(0);
  });
});
