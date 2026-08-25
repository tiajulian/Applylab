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

vi.mock("@/lib/requireUser", () => ({
  requireUser,
  assertPaidPlan,
  UnauthorizedError,
  PaidFeatureError,
}));

function makeBuilder(result: any) {
  const builder: any = {
    select: () => builder,
    update: () => builder,
    eq: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve: any) => resolve(result),
  };
  return builder;
}

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient, createServiceRoleClient: vi.fn() }));

function makeRequest(body: any) {
  return new Request("http://localhost/api/interview/sessions/s1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PAID_USER = { authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/interview/sessions/[id] - auth & entitlement", () => {
  it("returns 401 when logged out", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost"), { params: { id: "s1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a free-plan user", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1", plan: "free" } });
    assertPaidPlan.mockImplementationOnce(() => {
      throw new PaidFeatureError("Upgrade required");
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost"), { params: { id: "s1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the session isn't found for this user (RLS-scoped query returns nothing)", async () => {
    requireUser.mockResolvedValueOnce(PAID_USER);
    assertPaidPlan.mockImplementationOnce(() => {});
    createClient.mockReturnValue({
      from: () => makeBuilder({ data: null, error: { message: "not found" } }),
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost"), { params: { id: "not-mine" } });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/interview/sessions/[id] - status transitions", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue(PAID_USER);
    assertPaidPlan.mockImplementation(() => {});
  });

  it("rejects a client attempting to PATCH status directly to 'completed'", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(makeRequest({ status: "completed" }), { params: { id: "s1" } });
    expect(res.status).toBe(400);
  });

  it("allows a client to abandon their own session", async () => {
    createClient.mockReturnValue({
      from: () => makeBuilder({ data: null, error: null }),
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(makeRequest({ status: "abandoned" }), { params: { id: "s1" } });
    expect(res.status).toBe(200);
  });
});
