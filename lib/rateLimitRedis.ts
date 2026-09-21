import { redisPipeline } from "@/lib/redis";

/**
 * Redis sliding-window counter - same algorithm as the Postgres rate_limit_hit function, so
 * switching backends changes no limits. One round trip per check. Edge-safe (used by middleware).
 */
const SLIDING_WINDOW_LUA = `
local max = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local elapsed = tonumber(ARGV[3])
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
local weighted = prev * (1 - elapsed / window) + cur
if weighted + 1 > max then
  return {0, 0, math.max(1, math.ceil((window - elapsed) / 1000))}
end
redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], window * 2)
return {1, math.max(0, math.floor(max - (weighted + 1))), 0}
`;

export type RedisLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/** Returns null when Redis isn't configured or is unavailable (caller decides the fallback). */
export async function checkRedisRateLimit(
  rateKey: string,
  maxHits: number,
  windowMs: number
): Promise<RedisLimitResult | null> {
  const now = Date.now();
  const bucket = Math.floor(now / windowMs);
  const keyBase = `rl:{${rateKey}}`; // hash tag keeps both buckets on one shard if clustered

  const replies = await redisPipeline([
    [
      "EVAL",
      SLIDING_WINDOW_LUA,
      2,
      `${keyBase}:${bucket}`,
      `${keyBase}:${bucket - 1}`,
      maxHits,
      windowMs,
      now - bucket * windowMs,
    ],
  ]);
  const result = replies?.[0];
  if (!Array.isArray(result)) return null;
  return { allowed: result[0] === 1, remaining: result[1], retryAfterSeconds: result[2] };
}
