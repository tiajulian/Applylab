import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, reserve, refund, markFree, snapshot } = vi.hoisted(() => ({
  insert: vi.fn(),
  reserve: vi.fn(),
  refund: vi.fn(),
  markFree: vi.fn(),
  snapshot: vi.fn(),
}));

class UnauthorizedError extends Error {}
class FreeLimitReachedError extends Error {}

vi.mock("@/lib/requireUser", () => ({
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  FREE_RESUME_LIMIT: 1,
  FreeLimitReachedError,
  UnauthorizedError,
  requirePermanentUser: vi.fn().mockResolvedValue({
    authUserId: "user-1",
    appUser: { id: "user-1", plan: "free", full_name: "Sam Lee", email: "sam@example.com" },
  }),
  reserveResumeGeneration: reserve,
  refundResumeGeneration: refund,
  markFreeAllowanceResume: markFree,
}));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/resume/versions", () => ({ saveVersionSnapshot: snapshot }));

const from = vi.fn((table: string) => {
  if (table === "user_profiles") {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { phone: "0400", location: "Penrith, NSW", linkedin_url: null, work_rights: null } }) }),
      }),
    };
  }
  if (table === "resumes") {
    return { insert: (row: unknown) => ({ select: () => ({ single: async () => insert(row) }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from }) }));

const { POST } = await import("./route");

describe("POST /api/resumes (start from scratch)", () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ data: { id: "res-1" }, error: null });
    reserve.mockReset().mockResolvedValue(undefined);
    refund.mockReset().mockResolvedValue(undefined);
    markFree.mockReset().mockResolvedValue(undefined);
    snapshot.mockReset().mockResolvedValue(true);
  });

  it("creates an empty resume with only the contact block filled in", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    const [row] = insert.mock.calls[0];
    expect(row.job_description).toBe("");
    expect(row.resume_content.contact).toEqual({
      name: "Sam Lee",
      email: "sam@example.com",
      phone: "0400",
      location: "Penrith, NSW",
      linkedin: "",
      work_rights: "",
    });
    expect(row.resume_content.experience).toEqual([]);
    expect(markFree).toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
  });

  it("refunds the slot when the insert fails", async () => {
    insert.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await POST();

    expect(response.status).toBe(500);
    expect(refund).toHaveBeenCalledTimes(1);
  });

  it("still opens the resume, without a refund, when a follow-up after the insert fails", async () => {
    markFree.mockRejectedValue(new Error("transient"));

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resume: { id: "res-1" } });
    expect(refund).not.toHaveBeenCalled();
  });

  it("reports the free limit so the form can show Go Pro", async () => {
    reserve.mockRejectedValue(new FreeLimitReachedError("limit"));

    const response = await POST();

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FREE_LIMIT_REACHED");
    expect(insert).not.toHaveBeenCalled();
    expect(refund).not.toHaveBeenCalled();
  });
});
