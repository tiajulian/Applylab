import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/anthropic/client", () => ({ anthropic: {} }));
vi.mock("@/lib/openai/client", () => ({ openai: {} }));
vi.mock("@/lib/gemini/client", () => ({ gemini: {}, geminiOutputTokens: () => 0 }));
vi.mock("@/lib/googleTts/synthesizeSpeech", () => ({ synthesizeSpeech: vi.fn(), TtsError: class extends Error {} }));

import { assertAiAvailable, resetBreakerGuard } from "./breakerGuard";
import { AiUnavailableError } from "./errors";
import { callGateway } from "./gateway";
import { resetRedisCoolOff } from "@/lib/redis";

// 15 per-minute call buckets then 15 per-minute cost buckets, as the guard's pipeline returns them.
const redisReply = (calls: number, costMicro: number) => ({
  ok: true,
  json: async () => [
    ...Array.from({ length: 15 }, (_, i) => ({ result: i === 0 ? String(calls) : null })),
    ...Array.from({ length: 15 }, (_, i) => ({ result: i === 0 ? String(costMicro) : null })),
  ],
});

describe("AI circuit breaker enforcement", () => {
  beforeEach(() => {
    resetBreakerGuard();
    resetRedisCoolOff();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubEnv("AI_BREAKER_ENFORCE", "true");
    vi.stubEnv("AI_BREAKER_BASELINE_CALLS", "50");
    vi.stubEnv("AI_BREAKER_CRITICAL_MULTIPLIER", "3");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lets calls through at normal volume", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redisReply(20, 0)));
    await expect(assertAiAvailable()).resolves.toBeUndefined();
  });

  it("a spend spike flips the breaker and the next AI call is refused without touching a provider or the DB", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redisReply(200, 0))); // 200 calls > 3 x 50
    const invoke = vi.fn();
    const rpc = vi.fn();

    await expect(
      callGateway({
        supabase: { rpc, from: vi.fn() } as never,
        userId: "u1",
        tier: "pro",
        feature: "test",
        provider: "anthropic",
        model: "m",
        estimatedCredits: 5,
        invoke,
        extractUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
      })
    ).rejects.toBeInstanceOf(AiUnavailableError);

    expect(invoke).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("also trips on cost alone (a few expensive calls)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redisReply(5, 2_000_000))); // $2 > 3 x $0.50
    await expect(assertAiAvailable()).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("does not enforce (only observes) unless AI_BREAKER_ENFORCE=true", async () => {
    vi.stubEnv("AI_BREAKER_ENFORCE", "false");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redisReply(200, 0)));
    await expect(assertAiAvailable()).resolves.toBeUndefined();
  });

  it("fails open if its own state read breaks (credits remain the hard gate)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(assertAiAvailable()).resolves.toBeUndefined();
  });
});
