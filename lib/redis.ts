/**
 * Minimal Upstash REST client. Edge-safe (fetch only), so route handlers and middleware share it.
 *
 * Redis is the production primary store for rate limits, concurrency slots and the AI circuit
 * breaker; Postgres is only the degradation path when this returns null. Every call is ONE
 * round trip (a pipeline), with a tight timeout so a Redis blip can't stall the request path.
 */
const TIMEOUT_MS = 500;
/** After an error, skip Redis for ~30s (+ jitter so instances don't all retry in the same instant). */
const COOL_OFF_MS = 30_000;
const COOL_OFF_JITTER_MS = 10_000;

let retryRedisAt = 0;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export type RedisCommand = (string | number)[];

/**
 * Runs commands in one round trip. Returns each command's result, or null when Redis is not
 * configured, cooling off, or failed - the caller decides the fallback.
 */
export async function redisPipeline(commands: RedisCommand[]): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || Date.now() < retryRedisAt) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
    const replies = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = replies.find((r) => r.error);
    if (failed) throw new Error(failed.error);
    return replies.map((r) => r.result);
  } catch (error) {
    retryRedisAt = Date.now() + COOL_OFF_MS + Math.random() * COOL_OFF_JITTER_MS;
    console.error("redis: unavailable, pausing it for ~30s", error);
    return null;
  }
}

/** Test hook: forget any cool-off. */
export function resetRedisCoolOff(): void {
  retryRedisAt = 0;
}

// ---- Global/per-key semaphore (sorted set of holder ids scored by expiry) --------------------

const SEMAPHORE_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[3]), ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1
`;

export type RedisSlot =
  | { status: "acquired"; release: () => Promise<void> }
  | { status: "full" }
  | { status: "unavailable" };

/** Takes one of `max` slots for `name`. Slots self-expire after ttlMs, so a crash can't leak one. */
export async function acquireRedisSlot(name: string, max: number, ttlMs: number): Promise<RedisSlot> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `sem:{${name}}`;
  const replies = await redisPipeline([["EVAL", SEMAPHORE_LUA, 1, key, Date.now(), max, ttlMs, id]]);
  if (!replies) return { status: "unavailable" };
  if (replies[0] !== 1) return { status: "full" };
  return {
    status: "acquired",
    release: async () => {
      await redisPipeline([["ZREM", key, id]]); // best effort; the slot expires on its own anyway
    },
  };
}
