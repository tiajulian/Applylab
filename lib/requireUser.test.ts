import { describe, expect, it, vi } from "vitest";
import {
  AssistLimitReachedError,
  ContentScoreLimitReachedError,
  FREE_ASSIST_LIMIT_PER_RESUME,
  FREE_CONTENT_SCORE_LIMIT_PER_RESUME,
  FREE_RESUME_LIMIT,
  FreeLimitReachedError,
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
