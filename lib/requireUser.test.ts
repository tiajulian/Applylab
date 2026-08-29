import { describe, expect, it, vi } from "vitest";
import {
  AssistLimitReachedError,
  ContentScoreLimitReachedError,
  FREE_ASSIST_LIMIT_PER_RESUME,
  FREE_CONTENT_SCORE_LIMIT_PER_RESUME,
  FREE_RESUME_LIMIT,
  FreeLimitReachedError,
  PaidFeatureError,
  assertPaidPlan,
  assertResumeExportEntitlement,
  refundAssistCall,
  refundContentScore,
  refundResumeGeneration,
  reserveAssistCall,
  reserveContentScore,
  reserveResumeGeneration,
} from "./requireUser";

import type { AppUser } from "@/types";

function mockSupabase(rpcResult: { data?: unknown; error?: unknown }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) };
}

function appUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    email: "jamie@example.com",
    full_name: "Jamie Citizen",
    plan: "free",
    stripe_customer_id: null,
    resumes_used: 0,
    onboarded: true,
    profile_completeness: 100,
    is_admin: false,
    accepted_terms_at: "2024-01-01",
    accepted_terms_version: "2024-01-01",
    created_at: "2024-01-01",
    ...overrides,
  };
}

describe("reserveResumeGeneration", () => {
  it("passes the free-tier limit for a free-plan user", async () => {
    const supabase = mockSupabase({ data: true });
    await reserveResumeGeneration(supabase as never, appUser({ plan: "free" }));
    expect(supabase.rpc).toHaveBeenCalledWith("increment_resumes_used", {
      p_user_id: "user-1",
      p_limit: FREE_RESUME_LIMIT,
    });
  });

  it("passes no limit for a paid-plan user", async () => {
    const supabase = mockSupabase({ data: true });
    await reserveResumeGeneration(supabase as never, appUser({ plan: "pro" }));
    expect(supabase.rpc).toHaveBeenCalledWith("increment_resumes_used", {
      p_user_id: "user-1",
      p_limit: null,
    });
  });

  it("throws FreeLimitReachedError when the RPC reports the cap was hit", async () => {
    const supabase = mockSupabase({ data: false });
    await expect(reserveResumeGeneration(supabase as never, appUser())).rejects.toThrow(
      FreeLimitReachedError
    );
  });

  it("propagates a raw RPC error instead of swallowing it", async () => {
    const supabase = mockSupabase({ error: new Error("connection reset") });
    await expect(reserveResumeGeneration(supabase as never, appUser())).rejects.toThrow(
      "connection reset"
    );
  });
});

describe("reserveAssistCall / reserveContentScore", () => {
  it("throws AssistLimitReachedError when the per-resume cap is hit", async () => {
    const supabase = mockSupabase({ data: false });
    await expect(
      reserveAssistCall(supabase as never, appUser(), "resume-1")
    ).rejects.toThrow(AssistLimitReachedError);
  });

  it("passes the per-resume assist limit for a free-plan user", async () => {
    const supabase = mockSupabase({ data: true });
    await reserveAssistCall(supabase as never, appUser({ plan: "free" }), "resume-1");
    expect(supabase.rpc).toHaveBeenCalledWith("increment_assist_calls", {
      p_resume_id: "resume-1",
      p_limit: FREE_ASSIST_LIMIT_PER_RESUME,
    });
  });

  it("throws ContentScoreLimitReachedError when the per-resume cap is hit", async () => {
    const supabase = mockSupabase({ data: false });
    await expect(
      reserveContentScore(supabase as never, appUser(), "resume-1")
    ).rejects.toThrow(ContentScoreLimitReachedError);
  });

  it("passes the per-resume content-score limit for a free-plan user", async () => {
    const supabase = mockSupabase({ data: true });
    await reserveContentScore(supabase as never, appUser({ plan: "free" }), "resume-1");
    expect(supabase.rpc).toHaveBeenCalledWith("increment_content_score_count", {
      p_resume_id: "resume-1",
      p_limit: FREE_CONTENT_SCORE_LIMIT_PER_RESUME,
    });
  });
});

describe("refund* helpers", () => {
  it("never throws, even when the underlying RPC errors (best-effort refund)", async () => {
    const supabase = mockSupabase({ error: new Error("boom") });
    await expect(refundResumeGeneration(supabase as never, "user-1")).resolves.toBeUndefined();
    await expect(refundAssistCall(supabase as never, "resume-1")).resolves.toBeUndefined();
    await expect(refundContentScore(supabase as never, "resume-1")).resolves.toBeUndefined();
  });

  it("calls the matching decrement RPC with the right arguments", async () => {
    const supabase = mockSupabase({ error: null });
    await refundResumeGeneration(supabase as never, "user-1");
    expect(supabase.rpc).toHaveBeenCalledWith("decrement_resumes_used", { p_user_id: "user-1" });
  });
});

describe("assertPaidPlan", () => {
  it("allows pro and lifetime plans", () => {
    expect(() => assertPaidPlan(appUser({ plan: "pro" }))).not.toThrow();
    expect(() => assertPaidPlan(appUser({ plan: "lifetime" }))).not.toThrow();
  });

  it("throws PaidFeatureError for free plan", () => {
    expect(() => assertPaidPlan(appUser({ plan: "free" }))).toThrow(PaidFeatureError);
  });
});

describe("assertResumeExportEntitlement", () => {
  it("allows pro plan users without querying resume_unlocks table", async () => {
    const supabase = { from: vi.fn() };
    await expect(
      assertResumeExportEntitlement(supabase as never, appUser({ plan: "pro" }), "resume-1")
    ).resolves.toBeUndefined();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows lifetime plan users without querying resume_unlocks table", async () => {
    const supabase = { from: vi.fn() };
    await expect(
      assertResumeExportEntitlement(supabase as never, appUser({ plan: "lifetime" }), "resume-1")
    ).resolves.toBeUndefined();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("allows free plan users if resume has an active record in resume_unlocks", async () => {
    const mockSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "unlock-1", resume_id: "resume-1", user_id: "user-1" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    await expect(
      assertResumeExportEntitlement(mockSupabaseClient as never, appUser({ plan: "free" }), "resume-1")
    ).resolves.toBeUndefined();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith("resume_unlocks");
  });

  it("throws PaidFeatureError for free plan users if no resume_unlocks row exists", async () => {
    const mockSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    await expect(
      assertResumeExportEntitlement(mockSupabaseClient as never, appUser({ plan: "free" }), "resume-1")
    ).rejects.toThrow(PaidFeatureError);
  });

  it("propagates database errors when checking resume_unlocks", async () => {
    const mockSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("DB connection error"),
              }),
            }),
          }),
        }),
      }),
    };

    await expect(
      assertResumeExportEntitlement(mockSupabaseClient as never, appUser({ plan: "free" }), "resume-1")
    ).rejects.toThrow("DB connection error");
  });
});


vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  requireUser,
  requirePermanentUser,
  requireAdmin,
  UnauthorizedError,
  ForbiddenError,
} from "./requireUser";

describe("requireUser and requirePermanentUser authentication boundaries", () => {
  it("allows anonymous users in requireUser with isAnonymous flag set to true", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "anon-123", is_anonymous: true } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: appUser({ id: "anon-123" }),
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as never);

    const result = await requireUser();
    expect(result.authUserId).toBe("anon-123");
    expect(result.isAnonymous).toBe(true);
  });

  it("throws UnauthorizedError when requirePermanentUser is called by an anonymous user", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "anon-123", is_anonymous: true } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: appUser({ id: "anon-123" }),
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as never);

    await expect(requirePermanentUser()).rejects.toThrow(UnauthorizedError);
    await expect(requirePermanentUser()).rejects.toThrow("Permanent account required");
  });

  it("succeeds when requirePermanentUser is called by a permanent user", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "perm-456", is_anonymous: false } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: appUser({ id: "perm-456" }),
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as never);

    const result = await requirePermanentUser();
    expect(result.authUserId).toBe("perm-456");
    expect(result.appUser.id).toBe("perm-456");
  });

  it("throws UnauthorizedError when caller has no active session", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    };
    vi.mocked(createClient).mockReturnValue(mockClient as never);

    await expect(requireUser()).rejects.toThrow(UnauthorizedError);
    await expect(requireUser()).rejects.toThrow("Not authenticated");
  });

  it("throws ForbiddenError when requireAdmin is called by a non-admin user", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "perm-456", is_anonymous: false } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: appUser({ id: "perm-456", is_admin: false }),
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as never);

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
  });
});
