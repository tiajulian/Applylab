import { describe, expect, it } from "vitest";
import { buildComparison, diffWords, sideSegments } from "./diff";
import type { ReviewItem } from "./types";

const marked = (from: string, to: string, side: "add" | "del") =>
  sideSegments(diffWords(from, to), side).filter((s) => s.kind !== "same").map((s) => s.text);

describe("diffWords", () => {
  it("marks only the words that changed, on each side", () => {
    const from = "Cut report time using dbt.";
    const to = "Cut report time by 40% using dbt.";
    expect(marked(from, to, "add")).toEqual(["by 40% "]);
    expect(marked(from, to, "del")).toEqual([]);
  });

  it("marks each rewritten word and keeps both sides' full text", () => {
    const from = "Made weekly dashboards for sales.";
    const to = "Built weekly Tableau dashboards for sales.";
    expect(marked(from, to, "add")).toEqual(["Built", " Tableau"]);
    expect(marked(from, to, "del")).toEqual(["Made"]);
    const diff = diffWords(from, to);
    expect(sideSegments(diff, "add").map((s) => s.text).join("")).toBe(to);
    expect(sideSegments(diff, "del").map((s) => s.text).join("")).toBe(from);
  });

  it("joins two changed words separated by one space into a single highlight", () => {
    expect(marked("We shipped it.", "We quickly then shipped it.", "add")).toEqual(["quickly then "]);
  });

  it("reports no change for identical text and handles empty input", () => {
    expect(diffWords("same text", "same text")).toEqual([{ text: "same text", kind: "same" }]);
    expect(diffWords("", "new")).toEqual([{ text: "new", kind: "add" }]);
    expect(diffWords("old", "")).toEqual([{ text: "old", kind: "del" }]);
  });

  it("falls back to a whole replacement instead of building a huge table", () => {
    const long = (w: string) => Array.from({ length: 800 }, () => w).join(" ");
    expect(diffWords(long("a"), long("b")).map((s) => s.kind)).toEqual(["del", "add"]);
  });
});

describe("buildComparison", () => {
  const item = (over: Partial<ReviewItem>): ReviewItem => ({
    id: "x", resumeId: "r", kind: "fix", ruleId: "spelling", severity: "warn", blockId: "summary", start: 3, end: 11,
    before: "recieved", after: "received", reason: "", status: "open", ...over,
  });

  it("splices a fix into the block's full text", () => {
    expect(buildComparison(item({}), "We recieved it.")).toEqual({ original: "We recieved it.", suggested: "We received it.", flagged: null });
  });

  it("uses a rewrite's own before and after", () => {
    expect(buildComparison(item({ kind: "change", before: "old", after: "new" }), "new")).toEqual({ original: "old", suggested: "new", flagged: null });
  });

  it("flags the words when there is no replacement, and falls back when the text has moved on", () => {
    expect(buildComparison(item({ after: "" }), "We recieved it.").flagged).toEqual([3, 11]);
    expect(buildComparison(item({}), "Totally different now.")).toEqual({ original: "recieved", suggested: "received", flagged: null });
  });
});
