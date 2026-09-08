import { afterEach, describe, expect, it, vi } from "vitest";

// The provider clients construct themselves (and throw without an API key) at module load - see
// lib/openai/client.ts etc. gateway.ts re-exports them, so importing it transitively constructs
// all three. None of these tests exercise the real SDKs (invoke() is always a test-supplied
// function), so stub them the same way app/api/role-duties/route.test.ts already does.
vi.mock("@/lib/anthropic/client", () => ({ anthropic: {}, CLAUDE_MODEL: "claude-sonnet-4-6", CLAUDE_MODEL_FAST: "claude-haiku-4-5-20251001" }));
vi.mock("@/lib/openai/client", () => ({ openai: {} }));
vi.mock("@/lib/gemini/client", () => ({ gemini: {}, geminiOutputTokens: vi.fn() }));

import { callGateway, QuotaExceededError, SHADOW_MODE_QUOTA } from "./gateway";

/**
 * Mocks only the two things callGateway talks to on the Supabase client: the tier_quotas lookup
 * and the three RPCs (reserve/commit/refund_ai_credits). rpcResults lets a test script a
 * different response per RPC name/call - see the "same RPC called multiple times" tests below.
 */
function mockSupabase(options: {
  quota: number;
  window?: "lifetime" | "daily" | "monthly";
  reserveResult: { data?: unknown; error?: unknown };
  commitResult?: { data?: unknown; error?: unknown };
  refundResult?: { data?: unknown; error?: unknown };
}) {
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === "reserve_ai_credits") return Promise.resolve(options.reserveResult);
    if (name === "commit_ai_credits") return Promise.resolve(options.commitResult ?? { data: true, error: null });
    if (name === "refund_ai_credits") return Promise.resolve(options.refundResult ?? { data: true, error: null });
    throw new Error(`unexpected rpc: ${name}`);
  });

  return {
    rpc,
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { credits_per_window: options.quota, quota_window: options.window ?? "monthly" },
            error: null,
          }),
        }),
      }),
    }),
  };
}

const baseParams = {
  userId: "user-1",
  tier: "free" as const,
  feature: "generate-resume" as const,
  provider: "gemini" as const,
  model: "gemini-3.6-flash",
  estimatedCredits: 15,
};

describe("callGateway - pre-flight (spec §2)", () => {
  it("never calls invoke() when the reservation is refused", async () => {
    const supabase = mockSupabase({ quota: 40, reserveResult: { data: null, error: null } });
    const invoke = vi.fn();

    await expect(
      callGateway({
        ...baseParams,
        supabase: supabase as never,
        invoke,
        extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
      })
    ).rejects.toThrow(QuotaExceededError);

    // The whole point of a pre-flight check: refusing must mean the provider is never touched,
    // not just that the eventual response is an error (see the test plan's §2 red flag).
    expect(invoke).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith("commit_ai_credits", expect.anything());
  });

  it("succeeds and commits when the reservation is granted", async () => {
    const supabase = mockSupabase({ quota: 40, reserveResult: { data: "ledger-1", error: null } });
    const invoke = vi.fn().mockResolvedValue({ usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 } });

    const result = await callGateway({
      ...baseParams,
      supabase: supabase as never,
      invoke,
      extractUsage: (r: any) => ({
        inputTokens: r.usageMetadata.promptTokenCount,
        outputTokens: r.usageMetadata.candidatesTokenCount,
      }),
    });

    expect(result).toEqual({ usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 } });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "commit_ai_credits",
      expect.objectContaining({ p_ledger_id: "ledger-1", p_user_id: "user-1" })
    );
  });
});

describe("callGateway - credit cost derives from real tokens (spec §2/§5)", () => {
  it("commits a different credit amount for a bigger response, not a hardcoded number", async () => {
    const supabase = mockSupabase({ quota: 1000, reserveResult: { data: "ledger-1", error: null } });

    async function runWithTokens(inputTokens: number, outputTokens: number) {
      const commitCalls: unknown[] = [];
      supabase.rpc.mockImplementation((name: string, args: unknown) => {
        if (name === "reserve_ai_credits") return Promise.resolve({ data: "ledger-1", error: null });
        if (name === "commit_ai_credits") {
          commitCalls.push(args);
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: true, error: null });
      });

      await callGateway({
        ...baseParams,
        supabase: supabase as never,
        invoke: () => Promise.resolve({ inputTokens, outputTokens }),
        extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
      });

      return commitCalls[0] as { p_credits_actual: number; p_cost_usd: number };
    }

    const small = await runWithTokens(200, 100);
    const large = await runWithTokens(20_000, 8_000);

    // Real assertion: bigger token usage costs more credits. A test that hardcodes an expected
    // credit number instead would keep passing even if the pricing table silently went stale for
    // this model (see costLog.ts's comments - this exact failure hit Luna and Gemini before).
    expect(large.p_credits_actual).toBeGreaterThan(small.p_credits_actual);
    expect(large.p_cost_usd).toBeGreaterThan(small.p_cost_usd);
  });
});

describe("callGateway - reconciliation policy (spec §5, test plan §5)", () => {
  it("under-estimate: commits the real (higher) cost rather than capping at the reservation", async () => {
    // Policy choice made explicit here: the call already happened by the time actual cost is
    // known, so it is always let through once and the ledger is corrected to the true cost - it
    // is never silently truncated back down to the estimate. The next call's pre-flight check is
    // what enforces the cap going forward, not this one after the fact.
    const supabase = mockSupabase({ quota: 1000, reserveResult: { data: "ledger-1", error: null } });

    await callGateway({
      ...baseParams,
      estimatedCredits: 5,
      supabase: supabase as never,
      invoke: () => Promise.resolve({ inputTokens: 200_000, outputTokens: 80_000 }),
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    const [, commitArgs] = supabase.rpc.mock.calls.find(([name]) => name === "commit_ai_credits")!;
    expect((commitArgs as { p_credits_actual: number }).p_credits_actual).toBeGreaterThan(5);
  });

  it("over-estimate: commits the real (lower) cost, releasing the surplus back to the pool", async () => {
    // The reserved row's credits_reserved (5) is what a 'reserved' row counts toward balance;
    // once committed, the balance query switches to counting credits_actual instead (see the
    // migration's `case when status = 'committed' then credits_actual else credits_reserved end`)
    // - so committing a smaller real number is exactly how the surplus reaches the pool. Nothing
    // in the gateway itself needs to "release" anything separately.
    const supabase = mockSupabase({ quota: 1000, reserveResult: { data: "ledger-1", error: null } });

    await callGateway({
      ...baseParams,
      estimatedCredits: 500,
      supabase: supabase as never,
      invoke: () => Promise.resolve({ inputTokens: 50, outputTokens: 20 }),
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    const [, commitArgs] = supabase.rpc.mock.calls.find(([name]) => name === "commit_ai_credits")!;
    expect((commitArgs as { p_credits_actual: number }).p_credits_actual).toBeLessThan(500);
  });
});

describe("callGateway - failure & refund lifecycle (spec §4)", () => {
  it("retries a failing call up to the cap, then refunds exactly once and propagates the error", async () => {
    const supabase = mockSupabase({ quota: 40, reserveResult: { data: "ledger-1", error: null } });
    const invoke = vi.fn().mockRejectedValue(new Error("provider 503"));

    await expect(
      callGateway({
        ...baseParams,
        supabase: supabase as never,
        invoke,
        extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
      })
    ).rejects.toThrow("provider 503");

    // 1 initial attempt + MAX_GATEWAY_RETRIES(2) retries = 3 total - not an unbounded
    // reserve-refund-loop (the test plan's explicit §4 red flag).
    expect(invoke).toHaveBeenCalledTimes(3);
    const refundCalls = supabase.rpc.mock.calls.filter(([name]) => name === "refund_ai_credits");
    expect(refundCalls).toHaveLength(1);
    expect(refundCalls[0][1]).toEqual({ p_ledger_id: "ledger-1", p_user_id: "user-1" });
    expect(supabase.rpc).not.toHaveBeenCalledWith("commit_ai_credits", expect.anything());
  });

  it("does not refund when the call eventually succeeds within the retry cap", async () => {
    const supabase = mockSupabase({ quota: 40, reserveResult: { data: "ledger-1", error: null } });
    let attempts = 0;
    const invoke = vi.fn().mockImplementation(() => {
      attempts += 1;
      if (attempts < 2) return Promise.reject(new Error("transient"));
      return Promise.resolve({ inputTokens: 100, outputTokens: 50 });
    });

    await callGateway({
      ...baseParams,
      supabase: supabase as never,
      invoke,
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(supabase.rpc).not.toHaveBeenCalledWith("refund_ai_credits", expect.anything());
    expect(supabase.rpc).toHaveBeenCalledWith("commit_ai_credits", expect.anything());
  });

  it("does not re-invoke the provider, refund, or throw when commit_ai_credits fails after a successful call", async () => {
    // Regression test for a real bug: commit_ai_credits used to run inside the same try/catch as
    // invoke(), so a transient failure on this bookkeeping step (not the provider call itself)
    // was indistinguishable from invoke() failing - it looped back and called the (already
    // succeeded, already possibly billed) provider a second time, and could still refund +
    // throw to the caller even though the provider had genuinely succeeded.
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = mockSupabase({
      quota: 40,
      reserveResult: { data: "ledger-1", error: null },
      commitResult: { data: null, error: new Error("commit_ai_credits RPC failed") },
    });
    const invoke = vi.fn().mockResolvedValue({ inputTokens: 100, outputTokens: 50 });

    const result = await callGateway({
      ...baseParams,
      supabase: supabase as never,
      invoke,
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    // The caller still gets its real, successful result - a bookkeeping failure must never turn
    // a successful provider call into an error for the user.
    expect(result).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).not.toHaveBeenCalledWith("refund_ai_credits", expect.anything());
    // The commit error is logged (previously silently swallowed - the RPC's `{ error }` was never
    // checked at all), not thrown.
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("callGateway - lifetime window (spec §2/§11)", () => {
  it("passes a null window_start for a lifetime tier instead of a calendar-month bound", async () => {
    const supabase = mockSupabase({ quota: 40, window: "lifetime", reserveResult: { data: "ledger-1", error: null } });

    await callGateway({
      ...baseParams,
      supabase: supabase as never,
      invoke: () => Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    // A non-null window_start here would silently exclude every ledger row from the balance sum
    // (see the migration's `p_window_start is null or created_at >= p_window_start` guard) and
    // hand out unlimited free-tier credits - the exact bug this test pins down.
    expect(supabase.rpc).toHaveBeenCalledWith(
      "reserve_ai_credits",
      expect.objectContaining({ p_window_start: null })
    );
  });

  it("reports no reset date when a lifetime tier's quota is exhausted", async () => {
    const supabase = mockSupabase({ quota: 40, window: "lifetime", reserveResult: { data: null, error: null } });

    const error = await callGateway({
      ...baseParams,
      supabase: supabase as never,
      invoke: vi.fn(),
      extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    }).catch((e) => e);

    expect(error).toBeInstanceOf(QuotaExceededError);
    // Free never resets (spec §10/§15) - the UI must never render a reset date for it.
    expect((error as QuotaExceededError).resetsAt).toBeNull();
  });

  it("still passes a real calendar-month window_start for a monthly tier", async () => {
    const supabase = mockSupabase({ quota: 2000, window: "monthly", reserveResult: { data: "ledger-1", error: null } });

    await callGateway({
      ...baseParams,
      tier: "pro",
      supabase: supabase as never,
      invoke: () => Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "reserve_ai_credits",
      expect.objectContaining({ p_window_start: expect.any(String) })
    );
  });
});

describe("callGateway - shadow mode (spec §12/§14 migration aid)", () => {
  it("still invokes and commits real cost even when the real quota would have refused the reservation", async () => {
    const supabase = mockSupabase({ quota: 1, reserveResult: { data: null, error: null } });
    // reserve_ai_credits is a real RPC in shadow-mode tests too (not mocked to always succeed) -
    // simulate its actual behaviour: grant when the requested quota covers the estimate, refuse
    // otherwise. Shadow mode should request an effectively unlimited quota, not the real "1".
    supabase.rpc.mockImplementation((name: string, args: any) => {
      if (name === "reserve_ai_credits") {
        return Promise.resolve({ data: args.p_quota >= 15 ? "ledger-1" : null, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    const invoke = vi.fn().mockResolvedValue({ inputTokens: 100, outputTokens: 50 });

    const result = await callGateway({
      ...baseParams,
      shadow: true,
      supabase: supabase as never,
      invoke,
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    expect(result).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(invoke).toHaveBeenCalledTimes(1);

    // SHADOW_MODE_QUOTA is the quota-check threshold ONLY (p_quota, compared against inside the
    // RPC - see reserve_ai_credits' `v_used + p_estimated_credits > p_quota` guard). It must never
    // reach a column that's actually stored: credits_reserved comes from p_estimated_credits
    // (baseParams' real 15, unaffected by shadow) and credits_actual from the real reconciled
    // cost of the mocked 100/50 token response - this is the exact property item (1) of the
    // shadow-to-live checklist depends on: shadow data has to be trustworthy enough to set the
    // real free-tier number from. (Not Number.MAX_SAFE_INTEGER - that overflows Postgres' int4
    // p_quota column, confirmed live - see SHADOW_MODE_QUOTA's own comment in gateway.ts.)
    const [, reserveArgs] = supabase.rpc.mock.calls.find(([name]) => name === "reserve_ai_credits")!;
    expect((reserveArgs as { p_quota: number }).p_quota).toBe(SHADOW_MODE_QUOTA);
    expect((reserveArgs as { p_estimated_credits: number }).p_estimated_credits).toBe(baseParams.estimatedCredits);

    const [, commitArgs] = supabase.rpc.mock.calls.find(([name]) => name === "commit_ai_credits")!;
    const actual = (commitArgs as { p_credits_actual: number }).p_credits_actual;
    expect(actual).toBeGreaterThan(0);
    expect(actual).toBeLessThan(1000); // real cost for a 100/50-token call, nowhere near SHADOW_MODE_QUOTA
  });

  it("without shadow, the same over-quota scenario refuses instead of invoking", async () => {
    const supabase = mockSupabase({ quota: 1, reserveResult: { data: null, error: null } });
    const invoke = vi.fn();

    await expect(
      callGateway({
        ...baseParams,
        supabase: supabase as never,
        invoke,
        extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
      })
    ).rejects.toThrow(QuotaExceededError);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("callGateway - global shadow-to-live switch (spec §12/§14)", () => {
  // AI_GATEWAY_LIVE_ENFORCEMENT is read once into a module-level const at import time, so
  // exercising both states means re-importing the module fresh under each env value - a runtime
  // toggle wouldn't prove anything about the actual (module-load-time) mechanism callGateway uses.
  afterEach(() => {
    delete process.env.AI_GATEWAY_LIVE_ENFORCEMENT;
    vi.resetModules();
  });

  it("a call site's shadow: true stops protecting it once the global switch is on", async () => {
    process.env.AI_GATEWAY_LIVE_ENFORCEMENT = "true";
    vi.resetModules();
    const live = await import("./gateway");

    const supabase = mockSupabase({ quota: 1, reserveResult: { data: null, error: null } });
    const invoke = vi.fn();

    // Same call site code as the shadow-mode test above (shadow: true, unchanged) - only the env
    // var differs. If this ever starts invoking instead of refusing, the "one deliberate switch"
    // property is broken and someone would need to go edit every call site again by hand.
    await expect(
      live.callGateway({
        ...baseParams,
        shadow: true,
        supabase: supabase as never,
        invoke,
        extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
      })
    ).rejects.toThrow(live.QuotaExceededError);

    expect(invoke).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "reserve_ai_credits",
      expect.objectContaining({ p_quota: 1 })
    );
  });

  it("stays in shadow when the switch is left at its default (unset)", async () => {
    vi.resetModules();
    const fresh = await import("./gateway");

    const supabase = mockSupabase({ quota: 1, reserveResult: { data: "ledger-1", error: null } });
    const invoke = vi.fn().mockResolvedValue({ inputTokens: 10, outputTokens: 5 });

    await fresh.callGateway({
      ...baseParams,
      shadow: true,
      supabase: supabase as never,
      invoke,
      extractUsage: (r: any) => ({ inputTokens: r.inputTokens, outputTokens: r.outputTokens }),
    });

    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("callGateway - quota resolution (spec §10)", () => {
  it("fails closed (quota 0) when the tier has no configured row, instead of letting the call through", async () => {
    const supabase = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };

    await callGateway({
      ...baseParams,
      supabase: supabase as never,
      invoke: vi.fn(),
      extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    }).catch(() => {});

    expect(supabase.rpc).toHaveBeenCalledWith(
      "reserve_ai_credits",
      expect.objectContaining({ p_quota: 0 })
    );
  });
});
