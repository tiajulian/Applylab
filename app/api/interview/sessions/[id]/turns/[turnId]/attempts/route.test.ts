import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class PaidFeatureError extends Error {}
  return { requireUser: vi.fn(), assertPaidPlan: vi.fn(), UnauthorizedError, PaidFeatureError };
});

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: async () => null,
  acquireHeavySlots: async () => ({ release: async () => {} }),
}));
vi.mock("@/lib/requireUser", () => ({ requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError }));

const scoreInterviewAnswer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gemini/scoreInterviewAnswer", () => ({ scoreInterviewAnswer, rewriteWithoutClaims: vi.fn() }));

/** FIFO per table, one entry per terminal call (see the turns route test for the pattern). */
function makeSupabaseMock(tableQueues: Record<string, any[]>) {
  return {
    from(table: string) {
      const queue = tableQueues[table] || [];
      const pop = () => queue.shift() ?? { data: null, error: null };
      const builder: any = {};
      for (const m of ["select", "insert", "update", "eq", "is", "or", "not", "order"]) builder[m] = () => builder;
      builder.single = () => Promise.resolve(pop());
      builder.maybeSingle = () => Promise.resolve(pop());
      builder.then = (resolve: any, reject: any) => Promise.resolve(pop()).then(resolve, reject);
      return builder;
    },
  };
}

const { createClient, createServiceRoleClient } = vi.hoisted(() => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient, createServiceRoleClient }));

const SUBMISSION = "5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";
const PARAMS = { params: Promise.resolve({ id: "s1", turnId: "t1" }) };
const session = (extra: Record<string, unknown> = {}) => ({
  data: { id: "s1", user_id: "user-1", status: "in_progress", mode: "simulation", stage_type: "general", report_status: "pending", resume_id: "r1", resumes: {}, ...extra },
  error: null,
});
const answeredTurn = (extra: Record<string, unknown> = {}) => ({
  data: {
    id: "t1",
    session_id: "s1",
    transcript: "first",
    is_followup: false,
    order_index: 1,
    question_text: "Q1",
    question_type: "behavioural",
    star_scores: { situation: 2, task: 2, action: 2, result: 1, summary: "" },
    attempt_count: 1,
    ...extra,
  },
  error: null,
});

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/interview/sessions/s1/turns/t1/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
  assertPaidPlan.mockImplementation(() => {});
  createServiceRoleClient.mockReturnValue(makeSupabaseMock({}));
});

describe("POST /attempts (Try again)", () => {
  it("refuses a fourth try", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [session()], interview_turns: [answeredTurn({ attempt_count: 3 })] }));
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "again" }), PARAMS);
    expect(res.status).toBe(409);
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });

  it("refuses once the report has been built", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [session({ report_status: "ready" })], interview_turns: [answeredTurn()] }));
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "again" }), PARAMS);
    expect(res.status).toBe(409);
  });

  it("refuses a question that hasn't been answered yet", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [session()], interview_turns: [answeredTurn({ transcript: null, star_scores: null })] }));
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "again" }), PARAMS);
    expect(res.status).toBe(400);
  });

  it("returns the stored try when the same submission is retried", async () => {
    const stored = { id: "a2", turn_id: "t1", attempt_number: 2, submission_id: SUBMISSION };
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [session()],
        interview_turns: [answeredTurn({ attempt_count: 2 })],
        interview_turn_attempts: [{ data: stored, error: null }],
      })
    );
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "again", submissionId: SUBMISSION }), PARAMS);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.attempt.id).toBe("a2");
    expect(json.triesLeft).toBe(1);
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });

  it("scores and stores attempt 2 without adding a follow-up", async () => {
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [session()],
        interview_turns: [answeredTurn()],
        user_profiles: [{ data: null, error: null }],
      })
    );
    const inserted = { id: "a2", turn_id: "t1", attempt_number: 2 };
    createServiceRoleClient.mockReturnValue(
      makeSupabaseMock({
        interview_turns: [{ data: { id: "t1" }, error: null }, { data: null, error: null }],
        interview_turn_attempts: [{ data: inserted, error: null }],
      })
    );
    scoreInterviewAnswer.mockResolvedValue({
      transcript: "better",
      star_scores: { situation: 4, task: 4, action: 4, result: 4, summary: "" },
      filler_count: 0,
      wpm: 0,
      duration_sec: 0,
      content_feedback: "",
      delivery_feedback: "",
      suggested_answer: "better",
      needs_followup: true,
      followup_question: "What next?",
      score_reasons: null,
      biggest_fix: null,
      what_worked: [],
      transcript_spans: [],
      suggested_answer_sources: [],
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "better" }), PARAMS);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.attempt.attempt_number).toBe(2);
    expect(json.triesLeft).toBe(1);
    expect(json.next_question).toBeUndefined();
  });

  it("waits when another try for this question is still being scored", async () => {
    createClient.mockReturnValue(makeSupabaseMock({ interview_sessions: [session()], interview_turns: [answeredTurn()] }));
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "again" }), PARAMS);
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.code).toBe("STILL_PROCESSING");
  });
});

describe("scoring time window", () => {
  it("keeps maxDuration in step with the shared claim window", async () => {
    const { SCORING_ROUTE_MAX_SEC } = await import("@/lib/interview/answerPayload");
    const attempts = await import("./route");
    const turns = await import("../../route");
    expect(attempts.maxDuration).toBe(SCORING_ROUTE_MAX_SEC);
    expect(turns.maxDuration).toBe(SCORING_ROUTE_MAX_SEC);
  });
});
