import { describe, expect, it } from "vitest";
import { buildEntries, isRewordedInfo, matchesProfileCount, nextToReview, reviewProgress, type ReviewEntry } from "./progress";
import type { ReviewItem } from "./types";

let n = 0;
// Defaults to a fix, not a reworded rewrite - isRewordedInfo excludes reworded items from most of
// what this file tests (counts, nextToReview), so a bare item() should be counted unless a test
// explicitly wants the reworded case.
const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: `i${n++}`, resumeId: "r", kind: "fix", ruleId: "spelling", severity: "warn", blockId: "a",
  start: 0, end: 1, before: "b", after: "a", reason: "", status: "open", ...over,
});
const reworded = (over: Partial<ReviewItem> = {}): ReviewItem =>
  item({ kind: "change", ruleId: "provenance.reworded", severity: "info", provenance: "reworded", ...over });
const order = new Map([["a", 0], ["b", 1], ["c", 2]]);

describe("buildEntries", () => {
  it("maps statuses to states, in document order", () => {
    const second = item({ blockId: "b" });
    const first = item({ blockId: "a", status: "accepted" });
    const dismissed = item({ blockId: "c", kind: "fix", status: "dismissed" });
    const entries = buildEntries([dismissed, second, first], new Map(), order);
    expect(entries.map((e) => [e.item.id, e.state])).toEqual([[first.id, "accepted"], [second.id, "pending"], [dismissed.id, "kept"]]);
  });

  it("keeps a decided fix or reverted rewrite on screen from the log, and drops an unexplained resolved item", () => {
    const gone = item({ kind: "fix" });
    const reverted = item({ blockId: "b", status: "resolved" });
    const handEdited = item({ blockId: "c", status: "resolved" });
    const undo = { blockId: "b", from: "b", to: "a" };
    const log = new Map<string, ReviewEntry>([
      [gone.id, { item: gone, state: "accepted" }],
      [reverted.id, { item: reverted, state: "kept", undo }],
    ]);
    const entries = buildEntries([reverted, handEdited], log, order);
    expect(entries.map((e) => [e.item.id, e.state])).toEqual([[gone.id, "accepted"], [reverted.id, "kept"]]);
    expect(entries[1].undo).toBe(undo);
  });

  it("lets an open item reopen a logged decision", () => {
    const reopened = item();
    const log = new Map<string, ReviewEntry>([[reopened.id, { item: reopened, state: "accepted" }]]);
    expect(buildEntries([reopened], log, order)[0].state).toBe("pending");
  });
});

describe("isRewordedInfo", () => {
  it("is true only for a reworded change - never a fix or a new_claim change", () => {
    expect(isRewordedInfo(reworded())).toBe(true);
    expect(isRewordedInfo(item({ kind: "change", provenance: "new_claim", severity: "verify" }))).toBe(false);
    expect(isRewordedInfo(item({ kind: "fix" }))).toBe(false);
  });
});

describe("reviewProgress", () => {
  it("is the one source of the counts, and counts only unreviewed verify items", () => {
    const entry = (state: ReviewEntry["state"], over: Partial<ReviewItem> = {}): ReviewEntry => ({ item: item(over), state });
    const progress = reviewProgress([
      entry("accepted"), entry("kept"), entry("pending"),
      entry("pending", { severity: "verify" }), entry("accepted", { severity: "verify" }),
    ]);
    expect(progress).toEqual({ total: 5, reviewed: 3, accepted: 2, kept: 1, verify: 1 });
  });

  it("never counts a reworded item - accepted, kept or pending - it is never a decision to make", () => {
    const progress = reviewProgress([
      { item: item(), state: "pending" },
      { item: reworded(), state: "pending" },
      { item: reworded(), state: "accepted" },
      { item: reworded(), state: "kept" },
    ]);
    expect(progress).toEqual({ total: 1, reviewed: 0, accepted: 0, kept: 0, verify: 0 });
  });
});

describe("matchesProfileCount", () => {
  it("counts pending reworded rewrites only: never a new claim, a fix, or a decided card", () => {
    const ok = reworded();
    const entries: ReviewEntry[] = [
      { item: ok, state: "pending" },
      { item: item({ kind: "change", provenance: "new_claim", severity: "verify" }), state: "pending" },
      { item: item({ kind: "fix" }), state: "pending" },
      { item: reworded(), state: "accepted" },
    ];
    expect(matchesProfileCount(entries)).toBe(1);
  });
});

describe("nextToReview", () => {
  const pending = (over: Partial<ReviewItem>): ReviewEntry => ({ item: item({ kind: "change", ...over }), state: "pending" });
  const c1 = pending({});
  const c2 = pending({});
  const f1 = pending({ kind: "fix" });
  const f2 = pending({ kind: "fix" });

  it("stays in the tab, then jumps to the other one", () => {
    expect(nextToReview([c1, c2, f1, f2], new Set(), "change", c1.item.id)).toBe(c2.item);
    expect(nextToReview([c1, f1], new Set(), "change", c1.item.id)).toBe(f1.item);
  });

  it("brings skipped cards back last, this tab before the other", () => {
    expect(nextToReview([c1, c2, f1, f2], new Set([c2.item.id, f1.item.id]), "change", c1.item.id)).toBe(f2.item);
    expect(nextToReview([c1, c2, f1], new Set([c2.item.id, f1.item.id]), "change", c1.item.id)).toBe(c2.item);
    expect(nextToReview([c1, f1], new Set([f1.item.id]), "change", c1.item.id)).toBe(f1.item);
  });

  it("is null when nothing is left, ignoring decided cards", () => {
    expect(nextToReview([c1, { item: item(), state: "accepted" }], new Set(), "change", c1.item.id)).toBeNull();
  });

  it("skips a reworded item - it never gets a card to open", () => {
    const r = { item: reworded(), state: "pending" } as const;
    expect(nextToReview([r], new Set(), "change")).toBeNull();
    expect(nextToReview([r, f1], new Set(), "change")).toBe(f1.item);
  });
});
