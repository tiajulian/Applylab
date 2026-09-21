import { classifyBreaker, checkCircuitBreaker, type CircuitBreakerStatus } from "@/lib/aiGateway/circuitBreaker";
import { AiUnavailableError } from "@/lib/aiGateway/errors";
import { isRedisConfigured, redisPipeline } from "@/lib/redis";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Request-path enforcement of the AI spend circuit breaker.
 *
 * State lives in Redis as per-minute call and cost counters, written by the gateway's
 * reserve/commit/refund steps and read back as ONE pipeline (30 GETs) at most every CACHE_MS per
 * instance - so the hot path adds no DB round trip and, usually, no network call at all. Without
 * Redis it falls back to the ledger-based checkCircuitBreaker(), cached the same way.
 *
 * Enforcement is opt-in (AI_BREAKER_ENFORCE=true) because the baseline thresholds are still
 * unmeasured guesses: at the defaults "critical" is only ~150 AI calls per 15 minutes, which a
 * healthy launch could exceed. Set real baselines, then turn enforcement on. When not enforcing,
 * the guard still computes state and alerts if Redis is configured.
 */
const WINDOW_MINUTES = 15;
const CACHE_MS = 10_000;
const ALERT_COOLDOWN_S = 15 * 60;
const MICRO = 1_000_000; // Redis stores USD as integer micro-dollars

const enforcing = () => process.env.AI_BREAKER_ENFORCE === "true";
const minuteBucket = (t = Date.now()) => Math.floor(t / 60_000);

let cache: { status: CircuitBreakerStatus; at: number } | null = null;
let inFlight: Promise<CircuitBreakerStatus> | null = null;
let lastAlertAt = 0;

/** Test hook. */
export function resetBreakerGuard(): void {
  cache = null;
  inFlight = null;
  lastAlertAt = 0;
}

async function readStatus(): Promise<CircuitBreakerStatus | null> {
  if (isRedisConfigured()) {
    const now = minuteBucket();
    const buckets = Array.from({ length: WINDOW_MINUTES }, (_, i) => now - i);
    const replies = await redisPipeline([
      ...buckets.map((b) => ["GET", `brk:calls:${b}`]),
      ...buckets.map((b) => ["GET", `brk:cost:${b}`]),
    ]);
    if (replies) {
      const sum = (rs: unknown[]) => rs.reduce<number>((a, r) => a + (Number(r) || 0), 0);
      const calls = sum(replies.slice(0, WINDOW_MINUTES));
      const costUsd = sum(replies.slice(WINDOW_MINUTES)) / MICRO;
      return classifyBreaker(calls, costUsd).status;
    }
  }
  // No Redis (or it's down): ledger-based check. One query per CACHE_MS per instance.
  if (!enforcing()) return null;
  try {
    return (await checkCircuitBreaker(createServiceRoleClient())).status;
  } catch (error) {
    console.error("breakerGuard: ledger check failed", error);
    return null;
  }
}

async function sendAlert(): Promise<void> {
  const now = Date.now();
  if (now - lastAlertAt < ALERT_COOLDOWN_S * 1000) return;
  lastAlertAt = now;

  // Fleet-wide dedup: only the instance that wins SET NX alerts.
  const claim = await redisPipeline([["SET", "brk:alerted", "1", "NX", "EX", ALERT_COOLDOWN_S]]);
  if (claim && claim[0] !== "OK") return;

  const message = `ApplyLab AI circuit breaker is CRITICAL${enforcing() ? " - new AI calls are being rejected" : " (observe-only)"}.`;
  console.error(message);
  const webhook = process.env.AI_BREAKER_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }), // Slack/Discord-compatible incoming webhook shape
    signal: AbortSignal.timeout(2000),
  }).catch((error) => console.error("breakerGuard: alert webhook failed", error));
}

async function refresh(): Promise<CircuitBreakerStatus> {
  const status = (await readStatus()) ?? cache?.status ?? "normal";
  cache = { status, at: Date.now() };
  if (status === "critical") await sendAlert();
  return status;
}

async function currentStatus(): Promise<CircuitBreakerStatus> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.status;
  inFlight ??= refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Call before reserving credits. Throws AiUnavailableError (map to 503) when the breaker is
 * critical and enforcement is on. Never throws for its own failures: the credit reservation is
 * still a hard gate behind it, so a broken breaker degrades to "no extra protection", not an outage.
 */
export async function assertAiAvailable(): Promise<void> {
  if (!enforcing() && !isRedisConfigured()) return;
  try {
    const status = await currentStatus();
    if (status === "critical" && enforcing()) throw new AiUnavailableError(60);
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    console.error("breakerGuard: status check failed, allowing", error);
  }
}

/** Reserve step: one more call, plus the estimated cost (adjusted at commit/refund). */
export async function recordAiReserve(estimatedCredits: number): Promise<void> {
  if (!isRedisConfigured()) return;
  const b = minuteBucket();
  await redisPipeline([
    ["INCR", `brk:calls:${b}`],
    ["EXPIRE", `brk:calls:${b}`, (WINDOW_MINUTES + 2) * 60],
    ["INCRBY", `brk:cost:${b}`, Math.round(estimatedCredits * 0.001 * MICRO)],
    ["EXPIRE", `brk:cost:${b}`, (WINDOW_MINUTES + 2) * 60],
  ]);
}

/** Commit step: replace the reserved estimate with the real cost (delta may be negative). */
export async function recordAiCommit(estimatedCredits: number, actualCostUsd: number): Promise<void> {
  if (!isRedisConfigured()) return;
  const delta = Math.round((actualCostUsd - estimatedCredits * 0.001) * MICRO);
  await redisPipeline([["INCRBY", `brk:cost:${minuteBucket()}`, delta]]);
}

/** Refund step: the provider call failed, so its estimate no longer counts as spend. */
export async function recordAiRefund(estimatedCredits: number): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisPipeline([["INCRBY", `brk:cost:${minuteBucket()}`, -Math.round(estimatedCredits * 0.001 * MICRO)]]);
}
