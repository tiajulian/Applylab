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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/resume/parsedJobAdCache", () => ({
  getOrParseCompactJobAd: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/gemini/generateInterviewQuestions", () => ({
  generateInterviewQuestions: vi.fn().mockResolvedValue([]),
}));

function makeRequest(body: any) {
  return new Request("http://localhost/api/interview/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/interview/sessions - auth & entitlement", () => {
  it("returns 401 when logged out", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "general" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a free-plan user", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1", plan: "free" } });
    assertPaidPlan.mockImplementationOnce(() => {
      throw new PaidFeatureError("Upgrade required");
    });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "general" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/interview/sessions - input validation", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
    assertPaidPlan.mockImplementation(() => {});
  });

  it("rejects a missing resume_id", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ stage_type: "general" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid stage_type", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "not_a_real_stage" }));
    expect(res.status).toBe(400);
  });
});
