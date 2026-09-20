import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class FreeTierFeatureLimitReachedError extends Error {
    constructor(
      public feature: string,
      public limit: number
    ) {
      super("limit");
    }
  }
  return {
    UnauthorizedError,
    FreeTierFeatureLimitReachedError,
    requireUser: vi.fn(),
    reserveFreeTierFeature: vi.fn(),
    refund: vi.fn(),
    generateCoverLetter: vi.fn(),
    checkAndRecordRateLimit: vi.fn(),
    /** Results handed out, in order, to each supabase `from(table)` call on the user client. */
    queues: {} as Record<string, unknown[]>,
    insertResult: { current: null as unknown },
    insertSpy: vi.fn(),
  };
});

vi.mock("@/lib/requireUser", () => ({
  requireUser: mocks.requireUser,
  reserveFreeTierFeature: mocks.reserveFreeTierFeature,
  UnauthorizedError: mocks.UnauthorizedError,
  FreeTierFeatureLimitReachedError: mocks.FreeTierFeatureLimitReachedError,
  freeTierLimitReachedResponse: () => Response.json({ code: "FREE_LIMIT_REACHED" }, { status: 403 }),
  trackFreeTierReservation: () => {
    let reserved = false;
    return {
      markReserved: () => {
        reserved = true;
      },
      refundIfReserved: async () => {
        if (reserved) mocks.refund();
        reserved = false;
      },
    };
  },
}));

vi.mock("@/lib/anthropic/generateCoverLetter", () => ({ generateCoverLetter: mocks.generateCoverLetter }));
vi.mock("@/lib/resume/parsedJobAdCache", () => ({ getOrParseCompactJobAd: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/resume/sanitizeResumeContent", () => ({ sanitizeResumeContent: (c: unknown) => c }));
vi.mock("@/lib/rateLimit", () => ({ checkAndRecordRateLimit: mocks.checkAndRecordRateLimit }));

/** Every chain method returns the chain; awaiting or a terminal call resolves the queued result. */
function chain(result: unknown) {
  const node: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit"]) node[method] = () => node;
  node.maybeSingle = () => Promise.resolve(result);
  node.single = () => Promise.resolve(result);
  node.then = (resolve: (value: unknown) => void) => resolve(result);
  return node;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: (table: string) => chain((mocks.queues[table] ?? []).shift() ?? { data: null }) }),
  createServiceRoleClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        mocks.insertSpy(row);
        return chain(mocks.insertResult.current);
      },
    }),
  }),
}));

const LETTER = { id: "cl-1", title: "Analyst - Suncorp | Cover Letter" };
const RESUME = { id: "r1", resume_content: { contact: { name: "Sam" } } };

function post(body: unknown) {
  return new Request("http://localhost/api/cover-letters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const aiBody = { mode: "ai", resumeId: "r1", jobTitle: "Analyst", company: "Suncorp", idempotencyKey: "k1" };

async function loadPost(flag = "true") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_COVER_LETTER_V1", flag);
  return (await import("./route")).POST;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queues = {};
  mocks.insertResult.current = { data: LETTER, error: null };
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "free", full_name: "Sam" } });
  mocks.checkAndRecordRateLimit.mockResolvedValue(true);
  mocks.reserveFreeTierFeature.mockResolvedValue(undefined);
  mocks.generateCoverLetter.mockResolvedValue("Dear Hiring Manager,\n\nHello.\n\nKind regards,\nSam");
});

describe("POST /api/cover-letters", () => {
  it("404s while the feature flag is off", async () => {
    const POST = await loadPost("false");
    expect((await POST(post(aiBody))).status).toBe(404);
  });

  it("401s when logged out", async () => {
    mocks.requireUser.mockRejectedValueOnce(new mocks.UnauthorizedError());
    const POST = await loadPost();
    expect((await POST(post(aiBody))).status).toBe(401);
  });

  it("400s on invalid details and on a missing idempotency key", async () => {
    const POST = await loadPost();
    const invalid = await POST(post({ mode: "ai", idempotencyKey: "k" }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fields.jobTitle).toBeDefined();
    expect((await POST(post({ ...aiBody, idempotencyKey: "" }))).status).toBe(400);
  });

  it("returns the existing letter for a repeated idempotency key without creating another", async () => {
    mocks.queues.cover_letters = [{ data: LETTER }];
    const POST = await loadPost();
    const res = await POST(post(aiBody));
    expect(res.status).toBe(200);
    expect((await res.json()).coverLetter.id).toBe("cl-1");
    expect(mocks.insertSpy).not.toHaveBeenCalled();
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
  });

  it("rejects a free user at the letter cap with 402 COVER_LETTER_LIMIT before any AI work", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 1 }];
    const POST = await loadPost();
    const res = await POST(post(aiBody));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("COVER_LETTER_LIMIT");
    expect(mocks.reserveFreeTierFeature).not.toHaveBeenCalled();
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
  });

  it("creates a blank letter without touching the AI allowance", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 0 }];
    const POST = await loadPost();
    const res = await POST(post({ mode: "blank", jobTitle: "Analyst", company: "Suncorp", idempotencyKey: "k2" }));
    expect(res.status).toBe(201);
    expect(mocks.reserveFreeTierFeature).not.toHaveBeenCalled();
    expect(mocks.insertSpy.mock.calls[0][0]).toMatchObject({ created_via: "blank", user_id: "u1", idempotency_key: "k2" });
  });

  it("generates with AI, saves the letter and keeps the reservation", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 0 }];
    mocks.queues.resumes = [{ data: RESUME }];
    const POST = await loadPost();
    const res = await POST(post(aiBody));
    expect(res.status).toBe(201);
    expect(mocks.reserveFreeTierFeature).toHaveBeenCalledTimes(1);
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.insertSpy.mock.calls[0][0]).toMatchObject({ created_via: "ai", content: { contact: { name: "Sam" } } });
  });

  it("retries a failed generation once silently", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 0 }];
    mocks.queues.resumes = [{ data: RESUME }];
    mocks.generateCoverLetter.mockRejectedValueOnce(new Error("boom"));
    const POST = await loadPost();
    expect((await POST(post(aiBody))).status).toBe(201);
    expect(mocks.generateCoverLetter).toHaveBeenCalledTimes(2);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refunds the allowance and saves nothing when generation fails twice", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 0 }];
    mocks.queues.resumes = [{ data: RESUME }];
    mocks.generateCoverLetter.mockRejectedValue(new Error("boom"));
    const POST = await loadPost();
    const res = await POST(post(aiBody));
    expect(res.status).toBe(500);
    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it("refunds when the row cannot be saved, and returns the winner of a duplicate-key race", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 0 }, { data: LETTER }];
    mocks.queues.resumes = [{ data: RESUME }];
    mocks.insertResult.current = { data: null, error: { code: "23505" } };
    const POST = await loadPost();
    const res = await POST(post(aiBody));
    expect(res.status).toBe(200);
    expect(mocks.refund).toHaveBeenCalledTimes(1);
  });

  it("maps the free-tier AI cap to FREE_LIMIT_REACHED", async () => {
    mocks.queues.cover_letters = [{ data: null }, { count: 0 }];
    mocks.queues.resumes = [{ data: RESUME }];
    mocks.reserveFreeTierFeature.mockRejectedValueOnce(new mocks.FreeTierFeatureLimitReachedError("cover-letter", 2));
    const POST = await loadPost();
    const res = await POST(post(aiBody));
    expect(res.status).toBe(403);
    expect(mocks.generateCoverLetter).not.toHaveBeenCalled();
  });

  it("lets a paid user create past the free cap", async () => {
    mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "pro", full_name: "Sam" } });
    mocks.queues.cover_letters = [{ data: null }, { count: 50 }];
    const POST = await loadPost();
    const res = await POST(post({ mode: "blank", idempotencyKey: "k3" }));
    expect(res.status).toBe(201);
  });
});
