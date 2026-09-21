import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: vi.fn() }));

import { acquireHeavySlots, rateLimit } from "./rateLimit";
import { HEAVY_JOBS } from "./rateLimitPolicies";
import { resetRedisCoolOff } from "./redis";

/** In-memory stand-in for the Redis semaphore script: a sorted set per key, scored by expiry. */
function fakeRedis() {
  const sets = new Map<string, Map<string, number>>();
  let live = 0;
  let peak = 0;
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const cmds = JSON.parse(init.body) as (string | number)[][];
    const replies = cmds.map((cmd) => {
      if (cmd[0] === "EVAL") {
        const [, , , key, now, max, ttl, id] = cmd as [string, string, number, string, number, number, number, string];
        const set = sets.get(key) ?? new Map<string, number>();
        sets.set(key, set);
        for (const [k, exp] of set) if (exp <= now) set.delete(k);
        if (set.size >= max) return { result: 0 };
        set.set(id, now + ttl);
        if (key.includes("global:")) peak = Math.max(peak, ++live);
        return { result: 1 };
      }
      if (cmd[0] === "ZREM") {
        const removed = sets.get(cmd[1] as string)?.delete(cmd[2] as string);
        if (removed && (cmd[1] as string).includes("global:")) live -= 1;
        return { result: removed ? 1 : 0 };
      }
      return { result: null };
    });
    return { ok: true, json: async () => replies };
  });
  return { fetchMock, peak: () => peak };
}

beforeEach(() => {
  resetRedisCoolOff();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("global heavy-job concurrency", () => {
  it("never runs more Chromium jobs than the global cap, however many users fire at once", async () => {
    const redis = fakeRedis();
    vi.stubGlobal("fetch", redis.fetchMock);
    const cap = HEAVY_JOBS.pdf.globalMax;

    // 30 different users (so per-user limits are not what stops them) all start a PDF at once.
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => acquireHeavySlots({} as never, "pdf", `user-${i}`))
    );

    const admitted = results.filter((r) => "release" in r);
    const shed = results.flatMap((r) => ("response" in r ? [r.response] : []));
    expect(admitted).toHaveLength(cap);
    expect(shed).toHaveLength(30 - cap);
    expect(shed.every((r) => r.status === 503 && r.headers.get("Retry-After"))).toBe(true);
    expect(redis.peak()).toBe(cap);
  });

  it("limits one user to a single concurrent job and frees the slot on release", async () => {
    vi.stubGlobal("fetch", fakeRedis().fetchMock);

    const first = await acquireHeavySlots({} as never, "pdf", "same-user");
    const second = await acquireHeavySlots({} as never, "pdf", "same-user");
    expect("release" in first).toBe(true);
    expect("response" in second ? second.response.status : null).toBe(429);

    await (first as { release: () => Promise<void> }).release();
    expect("release" in (await acquireHeavySlots({} as never, "pdf", "same-user"))).toBe(true);
  });

  it("fails closed when neither Redis nor Postgres can answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "down" } });

    const result = await acquireHeavySlots({ rpc } as never, "pdf", "u");
    expect("response" in result).toBe(true);
  });
});

describe("with Redis reachable, rate-limit checks never touch Postgres", () => {
  it("rateLimit uses only Redis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ result: [1, 3, 0] }] }));
    const rpc = vi.fn();
    await rateLimit({ rpc, from: vi.fn() } as never, "k", 5, 60_000);
    expect(rpc).not.toHaveBeenCalled();
  });
});
