import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkRedisRateLimit } from "@/lib/rateLimitRedis";
import { acquireRedisSlot } from "@/lib/redis";
import { HEAVY_JOBS, type HeavyJobName } from "@/lib/rateLimitPolicies";

type SupabaseServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until a retry can succeed. 0 when allowed. */
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /**
   * What to do when no backend can answer. Default is fail CLOSED: every limited route costs
   * money or memory, and if the store is down the app is mostly down anyway. Pass true only for
   * a route where a limiter outage must not block a cheap, harmless action.
   */
  failOpen?: boolean;
};

/**
 * Sliding-window counter, decided atomically in one round trip. Redis (Upstash REST) when
 * UPSTASH_REDIS_REST_URL/TOKEN are set (lib/rateLimitRedis.ts) - sub-10ms, and it takes limiter
 * load off the primary Postgres. Otherwise, or if Redis errors, the public.rate_limit_hit SQL
 * function (atomic via a per-key advisory lock). Same algorithm in both, so switching backends
 * changes no limits.
 */
async function checkPostgres(
  supabase: SupabaseServiceRoleClient,
  rateKey: string,
  maxHits: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_key: rateKey,
    p_max: maxHits,
    p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    console.error("rateLimit: rate_limit_hit failed", error);
    return null;
  }
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

/** Atomically checks AND records one hit for `rateKey`. Rejected calls are not counted. */
export async function rateLimit(
  supabase: SupabaseServiceRoleClient,
  rateKey: string,
  maxHits: number,
  windowMs: number,
  { failOpen = false }: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const result =
    (await checkRedisRateLimit(rateKey, maxHits, windowMs)) ??
    (await checkPostgres(supabase, rateKey, maxHits, windowMs));
  if (result) return result;

  return failOpen
    ? { allowed: true, remaining: 0, retryAfterSeconds: 0 }
    : { allowed: false, remaining: 0, retryAfterSeconds: 5 };
}

/** Boolean convenience over {@link rateLimit}; existing call sites use this. */
export async function checkAndRecordRateLimit(
  supabase: SupabaseServiceRoleClient,
  rateKey: string,
  maxHits: number,
  windowMs: number,
  options?: RateLimitOptions
): Promise<boolean> {
  return (await rateLimit(supabase, rateKey, maxHits, windowMs, options)).allowed;
}

/**
 * Enforce a limit and return a ready-made 429 (with Retry-After) when exceeded, or null to
 * proceed. `if (blocked) return blocked;` keeps a route's limiter to two lines.
 */
export async function enforceRateLimit(
  rateKey: string,
  maxHits: number,
  windowMs: number,
  message = "Too many requests. Please try again shortly.",
  options?: RateLimitOptions
): Promise<NextResponse | null> {
  const result = await rateLimit(createServiceRoleClient(), rateKey, maxHits, windowMs, options);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) } }
  );
}

/**
 * Caps simultaneous in-flight work per key (a user, or a global name). Redis semaphore first;
 * Postgres leases (public.concurrency_acquire) only if Redis is unavailable. Slots self-expire
 * after `ttlMs`, so a crashed invocation can't leak one. Returns a release function, or null
 * when the cap is reached. If BOTH stores error: fails open by default (the request-rate limit
 * is still in front); pass failOpen: false for compute-heavy work to fail closed (returns null).
 */
export async function acquireConcurrencySlot(
  supabase: SupabaseServiceRoleClient,
  key: string,
  maxConcurrent: number,
  ttlMs: number,
  { failOpen = true }: RateLimitOptions = {}
): Promise<(() => Promise<void>) | null> {
  const slot = await acquireRedisSlot(key, maxConcurrent, ttlMs);
  if (slot.status === "acquired") return slot.release;
  if (slot.status === "full") return null;

  const { data, error } = await supabase.rpc("concurrency_acquire", {
    p_key: key,
    p_max: maxConcurrent,
    p_ttl_seconds: Math.max(1, Math.round(ttlMs / 1000)),
  });
  if (error) {
    console.error("acquireConcurrencySlot: both stores failed", error);
    return failOpen ? async () => {} : null;
  }
  if (!data) return null;
  return async () => {
    const { error: releaseError } = await supabase.rpc("concurrency_release", { p_lease_id: data });
    if (releaseError) console.error("concurrency_release failed (lease will expire)", releaseError);
  };
}

export type HeavySlots = { release: () => Promise<void> } | { response: NextResponse };

/**
 * Admits one heavy job: a per-user slot (one user can't hog capacity) AND a global slot (total
 * fleet-wide concurrency stays bounded however many users there are). Fails CLOSED. Returns a
 * ready 429 (this user already has one running) or 503 (system at capacity), or a release
 * function to call in `finally`.
 */
export async function acquireHeavySlots(
  supabase: SupabaseServiceRoleClient,
  job: HeavyJobName,
  userId: string
): Promise<HeavySlots> {
  const { perUser, globalMax, ttlMs } = HEAVY_JOBS[job];

  const releaseUser = await acquireConcurrencySlot(supabase, `user:${job}:${userId}`, perUser, ttlMs, { failOpen: false });
  if (!releaseUser) {
    return {
      response: NextResponse.json(
        { error: "You already have this running. Please wait for it to finish." },
        { status: 429, headers: { "Retry-After": "10" } }
      ),
    };
  }
  const releaseGlobal = await acquireConcurrencySlot(supabase, `global:${job}`, globalMax, ttlMs, { failOpen: false });
  if (!releaseGlobal) {
    await releaseUser();
    return {
      response: NextResponse.json(
        { error: "We're at capacity right now. Please try again in a few seconds." },
        { status: 503, headers: { "Retry-After": "15" } }
      ),
    };
  }
  return { release: async () => void (await Promise.all([releaseUser(), releaseGlobal()])) };
}
