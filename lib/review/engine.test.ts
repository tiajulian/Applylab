import { describe, expect, it } from "vitest";
import { buildPassages, capItems, countPassages, countVerify, reconcile } from "./engine";
import type { RawReviewItem, ReviewItem } from "./types";

const raw = (over: Partial<RawReviewItem> = {}): RawReviewItem => ({
  kind: "fix", ruleId: "spelling", severity: "warn", blockId: "summary", start: 0, end: 5,
  before: "recieved", after: "received", reason: "Spelling", ...over,
});
const base = { resumeId: "r1", dismissed: new Set<string>(), kept: new Set<string>() };
const run = (prev: ReviewItem[], items: RawReviewItem[], blocks = ["summary"], extra = {}) =>
  reconcile({ ...base, prev, raw: items, analysedBlocks: new Set(blocks), ...extra });

describe("reconcile", () => {
  it("keeps ids stable when the same rule hits the same text, even if it moves", () => {
    const [a] = run([], [raw({ start: 0, end: 8 })]);
    const [b] = run([a], [raw({ start: 10, end: 18 })]);
    expect(b.id).toBe(a.id);
    expect(b.start).toBe(10);
  });

  it("gives repeated occurrences of the same word distinct ids", () => {
    const items = run([], [raw({ start: 0 }), raw({ start: 20 })]);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });

  it("auto-resolves an open item whose text no longer matches", () => {
    const [a] = run([], [raw()]);
    const next = run([a], []);
    expect(next).toHaveLength(1);
    expect(next[0].status).toBe("resolved");
    expect(run(next, [])).toHaveLength(0);
  });

  it("resolves items whose block was deleted (analysed, nothing returned)", () => {
    const [a] = run([], [raw({ blockId: "experienceBullet:0:0" })], ["experienceBullet:0:0"]);
    expect(run([a], [], ["experienceBullet:0:0"])[0].status).toBe("resolved");
  });

  it("leaves items in blocks that were not re-analysed alone", () => {
    const [a] = run([], [raw()]);
    expect(run([a], [], ["other"])).toEqual([a]);
  });

  it("reopens an accepted fix if the text matches again (undo), and revives resolved items", () => {
    const [a] = run([], [raw()]);
    const resolved = run([a], []);
    expect(run(resolved, [raw()])[0].status).toBe("open");
    expect(run([{ ...a, status: "accepted" }], [raw()])[0].status).toBe("open");
  });

  it("applies persisted dismissals and kept changes by id", () => {
    const [a] = run([], [raw()]);
    expect(run([], [raw()], ["summary"], { dismissed: new Set([a.id]) })[0].status).toBe("dismissed");
    expect(run([], [raw()], ["summary"], { kept: new Set([a.id]) })[0].status).toBe("accepted");
  });
});

describe("counting", () => {
  let n = 0;
  const item = (over: Partial<ReviewItem>): ReviewItem => ({ ...raw(), id: `i${n++}`, resumeId: "r1", status: "open", ...over });

  it("counts only open warn/verify items", () => {
    const items = [item({ blockId: "a" }), item({ blockId: "b", severity: "verify" }), item({ blockId: "c", severity: "info" }),
      item({ blockId: "d", status: "dismissed" }), item({ blockId: "e", status: "resolved" })];
    expect(countPassages(items)).toBe(2);
    expect(countVerify(items)).toBe(1);
  });

  it("merges overlapping items into one passage coloured by the higher severity", () => {
    const passages = buildPassages([item({ start: 0, end: 10 }), item({ start: 5, end: 15, severity: "verify" }), item({ start: 30, end: 35 })]);
    expect(passages).toHaveLength(2);
    expect(passages[0]).toMatchObject({ start: 0, end: 15, severity: "verify" });
    expect(passages[0].itemIds).toHaveLength(2);
  });

  it("does not merge items that only touch or sit in different blocks", () => {
    expect(countPassages([item({ start: 0, end: 5 }), item({ start: 5, end: 9 }), item({ blockId: "x", start: 0, end: 5 })])).toBe(3);
  });

  it("caps the list and reports how many are hidden", () => {
    const { shown, hidden } = capItems(Array.from({ length: 250 }, (_, i) => i));
    expect([shown.length, hidden]).toEqual([200, 50]);
  });
});
