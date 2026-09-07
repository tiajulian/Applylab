import type { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export type CircuitBreakerStatus = "normal" | "elevated" | "critical";

export interface CircuitBreakerCheck {
  status: CircuitBreakerStatus;
  windowMinutes: number;
  callsInWindow: number;
  costUsdInWindow: number;
  baselineCallsPerWindow: number;
  baselineCostUsdPerWindow: number;
  callRatio: number;
  costRatio: number;
}

// PLACEHOLDER thresholds - founder-owned (spec §14 "The global circuit-breaker thresholds - once
// you have real provider-bill totals to base 'normal' on"), not derived from real traffic yet.
// Multipliers match the spec's own suggested starting point (§7: "alert at 1.5x normal, hard
// degrade at 3x"); the baseline volume/spend numbers are a guess at a quiet 15-minute window for
// this app's current size - replace both once real data exists (same "change in place, no deploy
// needed" spirit as tier_quotas would call for, if this also moves to a DB-config table later).
const WINDOW_MINUTES = 15;
const BASELINE_CALLS_PER_WINDOW = 50;
const BASELINE_COST_USD_PER_WINDOW = 0.5;
const ALERT_MULTIPLIER = 1.5;
const CRITICAL_MULTIPLIER = 3;

/**
 * Computes current AI call volume/spend against a baseline "normal" rate and classifies it
 * normal/elevated/critical - the spec's explicit requirement that the breaker trips on
 * rate-of-spend and call volume, not absolute dollars alone (a scripted abuser at $0.001/call
 * never crosses a dollar threshold but does cross a velocity one).
 *
 * Reads ai_usage_ledger directly (not api_cost_log) - this is scoped to calls already flowing
 * through the AI gateway. Cheap enough to call on a dashboard poll or a scheduled job; not wired
 * into the callGateway() hot path itself (see that decision's note in gateway.ts) - checking on
 * every single AI call would add a full-table query's latency and cost to every request for a
 * system-wide signal that doesn't need per-call freshness.
 */
export async function checkCircuitBreaker(supabase: ServiceRoleClient): Promise<CircuitBreakerCheck> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_usage_ledger")
    .select("cost_usd, credits_reserved, status")
    .gte("created_at", windowStart);

  if (error) throw error;

  const rows = data ?? [];
  const callsInWindow = rows.length;
  // committed rows carry the real reconciled cost; a still-open reservation only has an estimate
  // (credits_reserved, in credits not USD) - approximate its USD cost via CREDIT_VALUE_USD so an
  // in-flight burst of reservations still moves the spend-rate signal, not just settled calls.
  const CREDIT_VALUE_USD = 0.001;
  const costUsdInWindow = rows.reduce((sum, row) => {
    if (row.status === "committed") return sum + Number(row.cost_usd || 0);
    if (row.status === "reserved") return sum + Number(row.credits_reserved || 0) * CREDIT_VALUE_USD;
    return sum;
  }, 0);

  const callRatio = callsInWindow / BASELINE_CALLS_PER_WINDOW;
  const costRatio = costUsdInWindow / BASELINE_COST_USD_PER_WINDOW;
  const worstRatio = Math.max(callRatio, costRatio);

  const status: CircuitBreakerStatus =
    worstRatio >= CRITICAL_MULTIPLIER ? "critical" : worstRatio >= ALERT_MULTIPLIER ? "elevated" : "normal";

  return {
    status,
    windowMinutes: WINDOW_MINUTES,
    callsInWindow,
    costUsdInWindow,
    baselineCallsPerWindow: BASELINE_CALLS_PER_WINDOW,
    baselineCostUsdPerWindow: BASELINE_COST_USD_PER_WINDOW,
    callRatio,
    costRatio,
  };
}
