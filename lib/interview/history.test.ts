import { describe, expect, it } from "vitest";
import { RESUMABLE_FOR_MS, groupHistoryByJob, resumablePractice, type HistoryItem } from "./history";

const item = (over: Partial<HistoryItem>): HistoryItem => ({
  id: "s",
  createdAt: "2026-10-01T00:00:00Z",
  jobTitle: "Analyst",
  company: "Acme",
  stageType: "general",
  status: "finished",
  score: null,
  coaching: false,
  canOpen: true,
  ...over,
});

describe("groupHistoryByJob", () => {
  it("puts each job's practice together, newest job and practice first, with its latest score", () => {
    const groups = groupHistoryByJob([
      item({ id: "a1", createdAt: "2026-10-01T00:00:00Z", score: 3.1 }),
      item({ id: "b1", createdAt: "2026-10-03T00:00:00Z", jobTitle: "Officer", company: null }),
      item({ id: "a2", createdAt: "2026-10-05T00:00:00Z", status: "in_progress" }),
      item({ id: "a3", createdAt: "2026-10-04T00:00:00Z", jobTitle: "ANALYST", score: 4.2 }),
    ]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["a2", "a3", "a1"], ["b1"]]);
    expect(groups[0].latestScore).toBe(4.2);
    expect(groups[1].latestScore).toBeNull();
  });

  it("keeps the same title at different companies apart", () => {
    expect(groupHistoryByJob([item({ id: "1" }), item({ id: "2", company: "Other" })])).toHaveLength(2);
  });
});

describe("resumablePractice", () => {
  const now = Date.parse("2026-10-10T00:00:00Z");

  it("offers the newest unfinished practice from the last week", () => {
    const picked = resumablePractice(
      [
        item({ id: "old", status: "in_progress", createdAt: new Date(now - RESUMABLE_FOR_MS - 1).toISOString() }),
        item({ id: "recent", status: "in_progress", createdAt: "2026-10-08T00:00:00Z" }),
        item({ id: "newer", status: "in_progress", createdAt: "2026-10-09T00:00:00Z" }),
        item({ id: "done", createdAt: "2026-10-09T12:00:00Z" }),
      ],
      now
    );
    expect(picked?.id).toBe("newer");
  });

  it("offers nothing when every unfinished practice is over a week old", () => {
    expect(resumablePractice([item({ status: "in_progress", createdAt: "2026-09-01T00:00:00Z" })], now)).toBeNull();
  });
});
