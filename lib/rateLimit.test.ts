import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: vi.fn() }));

import { resetRedisCoolOff } from "@/lib/redis";
import { rateLimit, checkAndRecordRateLimit, acquireConcurrencySlot } from "./rateLimit";

const pgRow = (allowed: boolean, remaining = 0, retry = 0) => ({
  data: [{ allowed, remaining, retry_after_seconds: retry }],
  error: null,
});

describe("rateLimit (Postgres backend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls the atomic rpc with the window in whole seconds and returns its verdict", async () => {
    const rpc = vi.fn().mockResolvedValue(pgRow(true, 3));
    const result = await rateLimit({ rpc } as never, "k", 5, 60_000);

    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", { p_key: "k", p_max: 5, p_window_seconds: 60 });
    expect(result).toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0 });
  });

  it("surfaces retry-after when rejected", async () => {
    const rpc = vi.fn().mockResolvedValue(pgRow(false, 0, 42));
    const result = await rateLimit({ rpc } as never, "k", 5, 60_000);
    expect(result).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
  });

  it("fails closed by default when the store errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await checkAndRecordRateLimit({ rpc } as never, "k", 5, 60_000)).toBe(false);
  });

  it("fails open only when asked", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await checkAndRecordRateLimit({ rpc } as never, "k", 5, 60_000, { failOpen: true })).toBe(true);
  });
});

describe("rateLimit (Upstash backend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    resetRedisCoolOff();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Redis and never touches Postgres when Redis answers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ result: [1, 4, 0] }] }));
    const rpc = vi.fn();
    const result = await rateLimit({ rpc } as never, "k", 5, 60_000);

    expect(result).toEqual({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("skips Redis for the cool-off after a failure instead of paying its timeout on every request", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetchMock);
    const rpc = vi.fn().mockResolvedValue(pgRow(true, 2));

    await rateLimit({ rpc } as never, "k", 5, 60_000);
    await rateLimit({ rpc } as never, "k", 5, 60_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("falls back to Postgres when Redis is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const rpc = vi.fn().mockResolvedValue(pgRow(true, 2));
    const result = await rateLimit({ rpc } as never, "k", 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("acquireConcurrencySlot", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns null when the cap is reached", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    expect(await acquireConcurrencySlot({ rpc } as never, "k", 1, 60_000)).toBeNull();
  });

  it("returns a release that frees the lease", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "lease-1", error: null });
    const release = await acquireConcurrencySlot({ rpc } as never, "k", 1, 60_000);
    await release!();
    expect(rpc).toHaveBeenLastCalledWith("concurrency_release", { p_lease_id: "lease-1" });
  });

  it("fails open when the lease store errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await acquireConcurrencySlot({ rpc } as never, "k", 1, 60_000)).not.toBeNull();
  });
});
