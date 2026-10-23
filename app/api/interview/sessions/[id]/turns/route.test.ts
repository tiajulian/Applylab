import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class PaidFeatureError extends Error {}
  return {
    requireUser: vi.fn(),
    assertPaidPlan: vi.fn(),
    UnauthorizedError,
    PaidFeatureError,
  };
});

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: async () => null,
  acquireHeavySlots: async () => ({ release: async () => {} }),
}));

vi.mock("@/lib/requireUser", () => ({
  requireUser,
  assertPaidPlan,
  UnauthorizedError,
  PaidFeatureError,
}));

const scoreInterviewAnswer = vi.hoisted(() => vi.fn());
const rewriteWithoutClaims = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gemini/scoreInterviewAnswer", () => ({ scoreInterviewAnswer, rewriteWithoutClaims }));

const generateInterviewReport = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gemini/generateInterviewReport", () => ({ generateInterviewReport }));

/**
 * Minimal chainable Supabase query-builder fake. Each `.from(table)` call pulls the next queued
 * response for that table off a FIFO queue - the queue is filled in the exact order the route
 * code issues its calls, and every terminal call (`.single()`, `.maybeSingle()`, or bare `await`
 * on the builder) consumes one entry regardless of which terminal method was used. This mirrors
 * the route's actual call sequence closely enough to test branching without a live Supabase DB
 * (this repo has no live-DB test harness - see lib/__tests__/aiProviders.integration.test.ts for
 * the equivalent live/skip-if-no-key pattern used for real API calls).
 */
function makeSupabaseMock(tableQueues: Record<string, any[]>) {
  return {
    from(table: string) {
      const queue = tableQueues[table] || [];
      const pop = () => queue.shift() ?? { data: null, error: null };
      const builder: any = {
        select: () => builder,
        insert: () => builder,
        update: () => builder,
        eq: () => builder,
        is: () => builder,
        or: () => builder,
        order: () => builder,
        single: () => Promise.resolve(pop()),
        maybeSingle: () => Promise.resolve(pop()),
        then: (resolve: any, reject: any) => Promise.resolve(pop()).then(resolve, reject),
      };
      return builder;
    },
  };
}

const { createClient, createServiceRoleClient } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient, createServiceRoleClient }));

function makeRequest(body: any) {
  return new Request("http://localhost/api/interview/sessions/session-1/turns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PAID_USER = { authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/interview/sessions/[id]/turns - auth & entitlement", () => {
  it("returns 401 when the caller is not authenticated", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "hi" }), { params: { id: "s1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when a free-plan caller answers a session that isn't their free practice", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1", plan: "free" } });
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          { data: { id: "s1", user_id: "user-1", status: "in_progress", is_free_allowance: false, resume_id: "r1", resumes: {} }, error: null },
        ],
      })
    );
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "hi" }), { params: { id: "s1" } });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/interview/sessions/[id]/turns - input validation", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue(PAID_USER);
    assertPaidPlan.mockImplementation(() => {});
  });

  it("rejects a missing turnId", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ textAnswer: "hi" }), { params: { id: "s1" } });
    expect(res.status).toBe(400);
  });

  it("rejects when neither audio nor text answer is provided", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1" }), { params: { id: "s1" } });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized audio payload", async () => {
    const { POST } = await import("./route");
    const oversized = "a".repeat(21 * 1024 * 1024);
    const res = await POST(
      makeRequest({ turnId: "t1", audioBase64: oversized, mimeType: "audio/webm" }),
      { params: { id: "s1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too large/i);
  });

  it("rejects an unsupported audio mime type", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ turnId: "t1", audioBase64: "c2hvcnQ=", mimeType: "application/x-msdownload" }),
      { params: { id: "s1" } }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/unsupported/i);
  });
});

describe("POST /api/interview/sessions/[id]/turns - idempotency", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue(PAID_USER);
    assertPaidPlan.mockImplementation(() => {});
  });

  it("rejects resubmitting a turn that already has a transcript (409)", async () => {
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          {
            data: { id: "s1", user_id: "user-1", status: "in_progress", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: {} },
            error: null,
          },
        ],
        interview_turns: [
          { data: { id: "t1", session_id: "s1", transcript: "already answered", is_followup: false, order_index: 1 }, error: null },
        ],
      })
    );

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "second attempt" }), { params: { id: "s1" } });

    expect(res.status).toBe(409);
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });

  it("rejects submitting to a session that is not in_progress", async () => {
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          { data: { id: "s1", user_id: "user-1", status: "completed", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: {} }, error: null },
        ],
        interview_turns: [
          { data: { id: "t1", session_id: "s1", transcript: null, is_followup: false, order_index: 1 }, error: null },
        ],
      })
    );

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "late answer" }), { params: { id: "s1" } });

    expect(res.status).toBe(400);
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });
});

describe("POST /api/interview/sessions/[id]/turns - happy path (mocked Gemini)", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue(PAID_USER);
    assertPaidPlan.mockImplementation(() => {});
  });

  it("scores the final turn and finishes the session without building the report", async () => {
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          {
            data: { id: "s1", user_id: "user-1", status: "in_progress", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: { job_title: "Engineer", company_name: "Acme" } },
            error: null,
          },
        ],
        interview_turns: [
          { data: { id: "t1", session_id: "s1", transcript: null, is_followup: false, order_index: 1, question_text: "Q1", question_type: "behavioural" }, error: null },
        ],
        user_profiles: [{ data: null, error: null }],
      })
    );

    scoreInterviewAnswer.mockResolvedValue({
      transcript: "My answer",
      star_scores: { situation: 4, task: 4, action: 4, result: 4, summary: "Good" },
      filler_count: 1,
      wpm: 140,
      duration_sec: 60,
      content_feedback: "Solid",
      delivery_feedback: "Clear",
      suggested_answer: "My answer, reshaped",
      needs_followup: false,
      followup_question: null,
    });

    generateInterviewReport.mockResolvedValue({
      mode: "simulation",
      overall_score: 80,
      star_averages: { situation: 4, task: 4, action: 4, result: 4 },
      strengths: ["Clear communication"],
      areas_for_improvement: ["Quantify results"],
      delivery_summary: { avg_wpm: 140, pacing_rating: "good", pacing_feedback: "Good", filler_feedback: "Minimal" },
      question_summaries: [],
    });

    const updatedTurn = { id: "t1", session_id: "s1", transcript: "My answer", order_index: 1 };
    const serviceMock = makeSupabaseMock({
      interview_turns: [
        { data: { id: "t1" }, error: null }, // scoring claim -> maybeSingle()
        { data: updatedTurn, error: null }, // conditional update of current turn -> maybeSingle()
        { data: [{ ...updatedTurn, transcript: "My answer" }], error: null }, // fetch all turns
      ],
      interview_sessions: [{ data: null, error: null }], // final status update (bare await)
    });
    createServiceRoleClient.mockReturnValue(serviceMock);

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "My answer" }), { params: { id: "s1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.done).toBe(true);
    // The report is built separately (POST /sessions/[id]/report), so the last answer is fast.
    expect(json.report).toBeUndefined();
    expect(scoreInterviewAnswer).toHaveBeenCalledWith(expect.objectContaining({ mode: "simulation" }));
    expect(generateInterviewReport).not.toHaveBeenCalled();
  });
});

describe("POST /api/interview/sessions/[id]/turns - safe retry with submissionId", () => {
  const SUBMISSION = "5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f";

  beforeEach(() => {
    requireUser.mockResolvedValue(PAID_USER);
    assertPaidPlan.mockImplementation(() => {});
  });

  it("returns the stored result (200) when the same submission is retried, without scoring again", async () => {
    const scored = { id: "t1", session_id: "s1", transcript: "answered", is_followup: false, order_index: 1, submission_id: SUBMISSION };
    const next = { id: "t2", session_id: "s1", transcript: null, is_followup: false, order_index: 2, question_text: "Q2", question_type: "behavioural" };
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          { data: { id: "s1", user_id: "user-1", status: "in_progress", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: {} }, error: null },
          { data: { status: "in_progress", report: null }, error: null },
        ],
        interview_turns: [
          { data: scored, error: null },
          { data: [scored, next], error: null },
        ],
      })
    );

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "answered", submissionId: SUBMISSION }), { params: { id: "s1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.done).toBe(false);
    expect(json.next_question.id).toBe("t2");
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });

  it("still returns 409 when a different submission targets an answered turn", async () => {
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          { data: { id: "s1", user_id: "user-1", status: "in_progress", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: {} }, error: null },
        ],
        interview_turns: [
          { data: { id: "t1", session_id: "s1", transcript: "answered", is_followup: false, order_index: 1, submission_id: SUBMISSION }, error: null },
        ],
      })
    );

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ turnId: "t1", textAnswer: "other", submissionId: "11111111-2222-4333-8444-555555555555" }),
      { params: { id: "s1" } }
    );
    expect(res.status).toBe(409);
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });

  it("returns done on a retry after the session already completed", async () => {
    const scored = { id: "t1", session_id: "s1", transcript: "answered", is_followup: false, order_index: 1, submission_id: SUBMISSION };
    const report = { mode: "simulation", overall_score: 75 };
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          { data: { id: "s1", user_id: "user-1", status: "completed", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: {} }, error: null },
          { data: { status: "completed", report }, error: null },
        ],
        interview_turns: [
          { data: scored, error: null },
          { data: [scored], error: null },
        ],
      })
    );

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "answered", submissionId: SUBMISSION }), { params: { id: "s1" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.done).toBe(true);
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });

  it("rejects a malformed submissionId", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ turnId: "t1", textAnswer: "hi", submissionId: "not-a-uuid" }), { params: { id: "s1" } });
    expect(res.status).toBe(400);
  });

});

describe("POST /api/interview/sessions/[id]/turns - scoring claim", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue(PAID_USER);
    assertPaidPlan.mockImplementation(() => {});
  });

  it("does not score twice while another submit for the turn is still being scored", async () => {
    createClient.mockReturnValue(
      makeSupabaseMock({
        interview_sessions: [
          { data: { id: "s1", user_id: "user-1", status: "in_progress", mode: "simulation", stage_type: "general", resume_id: "r1", resumes: {} }, error: null },
        ],
        interview_turns: [
          { data: { id: "t1", session_id: "s1", transcript: null, is_followup: false, order_index: 1 }, error: null },
        ],
      })
    );
    // The claim update matches no row: a fresh claim is already held.
    createServiceRoleClient.mockReturnValue(makeSupabaseMock({ interview_turns: [{ data: null, error: null }] }));

    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ turnId: "t1", textAnswer: "retry", submissionId: "5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f" }),
      { params: { id: "s1" } }
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.code).toBe("STILL_PROCESSING");
    expect(scoreInterviewAnswer).not.toHaveBeenCalled();
  });
});
