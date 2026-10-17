import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class PaidFeatureError extends Error {}
  return { requireUser: vi.fn(), assertPaidPlan: vi.fn(), UnauthorizedError, PaidFeatureError };
});

vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/requireUser", () => ({ requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError }));

const generateInterviewReport = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gemini/generateInterviewReport", () => ({ generateInterviewReport }));

function makeSupabaseMock(tableQueues: Record<string, any[]>, updates: unknown[] = []) {
  return {
    from(table: string) {
      const queue = tableQueues[table] || [];
      const pop = () => queue.shift() ?? { data: null, error: null };
      const builder: any = {};
      for (const m of ["select", "eq", "or", "order"]) builder[m] = () => builder;
      builder.update = (payload: unknown) => {
        updates.push({ table, payload });
        return builder;
      };
      builder.single = () => Promise.resolve(pop());
      builder.maybeSingle = () => Promise.resolve(pop());
      builder.then = (resolve: any, reject: any) => Promise.resolve(pop()).then(resolve, reject);
      return builder;
    },
  };
}

const { createClient, createServiceRoleClient } = vi.hoisted(() => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient, createServiceRoleClient }));

const PARAMS = { params: { id: "s1" } };
const completed = (extra: Record<string, unknown> = {}) => ({
  data: { id: "s1", user_id: "user-1", status: "completed", mode: "simulation", stage_type: "general", report_status: "pending", report: null, resumes: {}, ...extra },
  error: null,
});
const star = (n: number) => ({ situation: n, task: n, action: n, result: n, summary: "" });

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
  assertPaidPlan.mockImplementation(() => {});
});

describe("POST /report", () => {
  it("returns a ready report without rebuilding it", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [completed({ report_status: "ready", report: { overall_score: 70 } })] }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), PARAMS);
    expect((await res.json()).report.overall_score).toBe(70);
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });

  it("leaves a build that is already running to finish (202)", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [completed({ report_status: "building" })] }));
    createServiceRoleClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [{ data: null, error: null }] }));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(202);
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });

  it("builds from best tries, lists skipped questions and averages answered ones only", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [completed()] }));
    const updates: any[] = [];
    const turns = [
      { id: "t1", order_index: 1, question_text: "Q1", question_type: "behavioural", is_followup: false, transcript: "a", star_scores: star(2), attempt_count: 2 },
      { id: "t2", order_index: 2, question_text: "Q2", question_type: "behavioural", is_followup: false, transcript: null, skipped: true, star_scores: null },
    ];
    const attempts = [{ id: "a2", turn_id: "t1", attempt_number: 2, transcript: "b", star_scores: star(4) }];
    createServiceRoleClient.mockReturnValue(
      makeSupabaseMock(
        {
          interview_sessions: [{ data: { id: "s1" }, error: null }, { data: null, error: null }],
          interview_turns: [{ data: turns, error: null }],
          interview_turn_attempts: [{ data: attempts, error: null }],
        },
        updates
      )
    );
    generateInterviewReport.mockImplementation(async ({ turns: given }: { turns: any[] }) => ({
      mode: "simulation",
      overall_score: 80,
      star_averages: star(4),
      strengths: [],
      areas_for_improvement: [],
      delivery_summary: { avg_wpm: 0, pacing_rating: "good", pacing_feedback: "", filler_feedback: "" },
      question_summaries: given.map((t) => ({ key_takeaway: `about ${t.id}` })),
    }));

    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), PARAMS);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Only the answered question went to the report writer, with its best (second) try.
    const given = generateInterviewReport.mock.calls[0][0].turns;
    expect(given).toHaveLength(1);
    expect(given[0].transcript).toBe("b");
    expect(json.report.question_summaries.map((s: any) => [s.turn_id, s.skipped, s.tries])).toEqual([
      ["t1", false, 2],
      ["t2", true, 0],
    ]);
    expect(json.report.question_summaries[0].first_star_scores).toEqual(star(2));
    expect(updates.at(-1).payload.report_status).toBe("ready");
  });

  it("marks the report failed (never the answers) when the build throws", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [completed()] }));
    const updates: any[] = [];
    createServiceRoleClient.mockReturnValue(
      makeSupabaseMock(
        {
          interview_sessions: [{ data: { id: "s1" }, error: null }],
          interview_turns: [{ data: [{ id: "t1", transcript: "a", star_scores: star(3) }], error: null }],
          interview_turn_attempts: [{ data: [], error: null }],
        },
        updates
      )
    );
    generateInterviewReport.mockRejectedValue(new Error("boom"));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), PARAMS);
    expect(res.status).toBe(500);
    expect(updates.at(-1).payload).toEqual({ report_status: "failed" });
  });
});
