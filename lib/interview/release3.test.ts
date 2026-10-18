import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/requireUser", () => {
  class PaidFeatureError extends Error {}
  return { PaidFeatureError };
});

import { familyAverages, overallAverage, rubricForQuestionType, turnScores } from "./rubrics";
import { historyStatus, lowestPartInsight, practiceSummaries, progressPoints, toHistoryItem, type ProgressPoint } from "./history";
import { FreeInterviewUsedError, assertSessionAccess, claimFreePractice, freePracticesLeft } from "./allowance";
import type { StarScores } from "@/types";

const star = (s: number, t: number, a: number, r: number): StarScores => ({ situation: s, task: t, action: a, result: r, summary: "" });
type T = Parameters<typeof turnScores>[0] & { session_id?: string };

describe("rubrics", () => {
  it("marks each question type the agreed way", () => {
    expect(rubricForQuestionType("behavioural")).toBe("star");
    expect(rubricForQuestionType("scenario")).toBe("star");
    expect(rubricForQuestionType("technical")).toBe("technical");
    expect(rubricForQuestionType("motivation")).toBe("motivation");
    expect(rubricForQuestionType("gap")).toBe("gap");
    expect(rubricForQuestionType("coding")).toBe("coding");
    expect(rubricForQuestionType("group_coaching")).toBeNull();
  });

  it("scores a motivation answer on its own parts, never STAR", () => {
    const s = turnScores({
      rubric: "motivation",
      question_type: "motivation",
      star_scores: null,
      rubric_scores: { relevance: 4, reasons: 2, structure: 3, length: 5 },
      score_reasons: { reasons: "Nothing from the ad." },
    })!;
    expect(s.definition.kind).toBe("Motivation question");
    expect(s.parts.map((p) => p.label)).toEqual(["Relevance to this role", "Specific reasons", "Clear structure", "Length"]);
    expect(s.parts[1].reason).toBe("Nothing from the ad.");
    expect(s.average).toBe(3.5);
  });

  it("never gives coaching answers a number", () => {
    expect(turnScores({ rubric: "coding", question_type: "coding", star_scores: null, rubric_scores: null, score_reasons: null })).toBeNull();
  });

  it("keeps families apart and averages answered questions only", () => {
    const turns: T[] = [
      { rubric: "star", question_type: "behavioural", star_scores: star(4, 4, 2, 2), rubric_scores: null, score_reasons: null },
      { rubric: "technical", question_type: "technical", star_scores: star(2, 2, 4, 4), rubric_scores: null, score_reasons: null },
      { rubric: "gap", question_type: "gap", star_scores: null, rubric_scores: { honesty: 5, bridge: 4, plan: 3 }, score_reasons: null },
    ];
    const fam = familyAverages(turns);
    expect(fam.star).toEqual({ situation: 3, task: 3, action: 3, result: 3 });
    expect(fam.gap).toEqual({ honesty: 5, bridge: 4, plan: 3 });
    expect(fam.motivation).toBeUndefined();
    expect(overallAverage(turns)).toBe(3.3);
  });
});

describe("history and progress", () => {
  it("names each session's state", () => {
    expect(historyStatus({ status: "in_progress", ended_reason: null })).toBe("in_progress");
    expect(historyStatus({ status: "completed", ended_reason: "ended_early" })).toBe("ended_early");
    expect(historyStatus({ status: "abandoned", ended_reason: "ended_early" })).toBe("ended_early");
    expect(historyStatus({ status: "completed", ended_reason: "completed" })).toBe("finished");
  });

  it("shows a 1-5 score for scored sessions and none for coaching", () => {
    const base = { id: "s", created_at: "2026-10-01", stage_type: "general" as const, pressure_level: "tough" as const, status: "completed" as const, ended_reason: null, resume_id: "r" };
    expect(toHistoryItem({ ...base, overall_score: 74, mode: "simulation" }).score).toBe(3.7);
    expect(toHistoryItem({ ...base, overall_score: null, mode: "coaching" })).toMatchObject({ score: null, coaching: true });
    expect(toHistoryItem({ ...base, status: "abandoned", overall_score: null, mode: "simulation" }).canOpen).toBe(false);
  });

  it("builds progress from first tries, oldest first, skipping coaching sessions", () => {
    const sessions = [
      { id: "b", resume_id: "r1", created_at: "2026-10-05", mode: "simulation" as const },
      { id: "a", resume_id: "r1", created_at: "2026-10-01", mode: "simulation" as const },
      { id: "c", resume_id: "r2", created_at: "2026-10-07", mode: "coaching" as const },
    ];
    const turns = [
      { session_id: "a", rubric: "star" as const, question_type: "behavioural", star_scores: star(2, 2, 2, 2), rubric_scores: null, score_reasons: null },
      { session_id: "b", rubric: "star" as const, question_type: "behavioural", star_scores: star(4, 4, 4, 2), rubric_scores: null, score_reasons: null },
    ];
    const points = progressPoints(sessions, turns);
    expect(points.map((p) => [p.sessionId, p.overall])).toEqual([
      ["a", 2],
      ["b", 3.5],
    ]);
    expect(points[1].parts?.result).toBe(2);
  });

  it("only calls out a lowest part when it's a pattern", () => {
    const pt = (parts: Record<string, number>): ProgressPoint => ({ sessionId: Math.random().toString(), jobKey: "r", date: "", overall: 3, parts: parts as ProgressPoint["parts"] });
    const resultLow = { situation: 4, task: 4, action: 4, result: 2 };
    expect(lowestPartInsight([pt(resultLow), pt(resultLow)])).toBeNull();
    expect(lowestPartInsight([pt(resultLow), pt(resultLow), pt(resultLow), pt({ situation: 2, task: 4, action: 4, result: 4 })])).toMatchObject({
      part: "result",
      count: 3,
      of: 4,
    });
  });

  it("summarises practice per application, latest first", () => {
    const map = practiceSummaries(
      [
        { id: "old", created_at: "2026-10-01", overall_score: 60, application_id: "app1" },
        { id: "new", created_at: "2026-10-14", overall_score: 72, application_id: "app1", star_averages: { situation: 4, task: 4, action: 3, result: 2 } },
        { id: "x", created_at: "2026-10-02", overall_score: null, application_id: null },
      ],
      (r) => r.application_id
    );
    expect(map.size).toBe(1);
    expect(map.get("app1")).toEqual({ count: 2, lastAt: "2026-10-14", lastScore: 3.6, lastSessionId: "new", weakestPart: "Result" });
  });
});

describe("free practice allowance", () => {
  it("lets free users into their own free session only", () => {
    expect(() => assertSessionAccess({ plan: "free" }, { is_free_allowance: true })).not.toThrow();
    expect(() => assertSessionAccess({ plan: "free" }, { is_free_allowance: false })).toThrow();
    expect(() => assertSessionAccess({ plan: "pro" }, { is_free_allowance: false })).not.toThrow();
  });

  it("counts what's left", () => {
    expect(freePracticesLeft({ plan: "free", free_interviews_used: 0 })).toBe(1);
    expect(freePracticesLeft({ plan: "free", free_interviews_used: 1 })).toBe(0);
    expect(freePracticesLeft({ plan: "pro" })).toBe(Infinity);
  });

  it("claims atomically and refuses a second free session (deleting the first doesn't reset it)", async () => {
    const service = (claimed: boolean) =>
      ({
        from: () => {
          const q: any = { update: () => q, eq: () => q, select: () => q, maybeSingle: async () => ({ data: claimed ? { id: "u" } : null }) };
          return q;
        },
      }) as any;
    await expect(claimFreePractice(service(true), { id: "u", free_interviews_used: 0 })).resolves.toBeUndefined();
    // Another tab got there first: the conditional update matched nothing.
    await expect(claimFreePractice(service(false), { id: "u", free_interviews_used: 0 })).rejects.toBeInstanceOf(FreeInterviewUsedError);
    await expect(claimFreePractice(service(true), { id: "u", free_interviews_used: 1 })).rejects.toBeInstanceOf(FreeInterviewUsedError);
  });
});


describe("review fixes", () => {
  it("reads motivation answers scored on STAR before rubrics existed", () => {
    const legacy = { rubric: null, question_type: "motivation", star_scores: star(4, 3, 4, 2), rubric_scores: null, score_reasons: null };
    expect(turnScores(legacy)?.rubric).toBe("star");
    expect(turnScores(legacy)?.average).toBe(3.3);
  });

  it("gives the follow-up rules the right part for each rubric", async () => {
    const { followupSignals } = await import("./rubrics");
    expect(
      followupSignals(turnScores({ rubric: "gap", question_type: "gap", star_scores: null, rubric_scores: { honesty: 5, bridge: 4, plan: 1 }, score_reasons: null }))
    ).toEqual({ outcomeScore: 1, weakestScore: 1 });
    expect(
      followupSignals(turnScores({ rubric: "star", question_type: "behavioural", star_scores: star(1, 4, 3, 4), rubric_scores: null, score_reasons: null }))
    ).toEqual({ outcomeScore: 4, weakestScore: 3 });
    expect(followupSignals(null)).toEqual({ outcomeScore: null, weakestScore: null });
  });

  it("takes the latest score that exists when the newest practice has none", () => {
    const map = practiceSummaries(
      [
        { id: "scored", created_at: "2026-10-01", overall_score: 72, application_id: "a", star_averages: { situation: 4, task: 4, action: 4, result: 2 } },
        { id: "latest", created_at: "2026-10-09", overall_score: null, application_id: "a" },
      ],
      (r) => r.application_id
    );
    expect(map.get("a")).toMatchObject({ count: 2, lastSessionId: "latest", lastScore: 3.6, weakestPart: "Result" });
  });
});
