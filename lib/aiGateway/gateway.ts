import { anthropic } from "@/lib/anthropic/client";
import { openai } from "@/lib/openai/client";
import { gemini, geminiOutputTokens } from "@/lib/gemini/client";
import { synthesizeSpeech, TtsError } from "@/lib/googleTts/synthesizeSpeech";
import { estimateCostUsd } from "@/lib/anthropic/costLog";
import type { AiProvider } from "@/lib/anthropic/models";
import type { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/types";

// The only place in the app allowed to hold these three client instances (plus the TTS call
// function, which has no client instance of its own) - every feature routes through callGateway()
// below instead of importing lib/anthropic/client.ts, lib/openai/client.ts, lib/gemini/client.ts,
// or lib/googleTts/synthesizeSpeech.ts directly. Re-exported (not re-instantiated), including the
// one pure helper (geminiOutputTokens) that also lives in lib/gemini/client.ts, so a feature file
// never has a reason to import from those paths itself. Enforced by .eslintrc.js's no-restricted-
// imports rule (fails `next build`/`npm run lint` on a new violation) - see that file's own
// shrink-only exception list for the call sites still pending migration onto this gateway.
export { anthropic, openai, gemini, geminiOutputTokens, synthesizeSpeech, TtsError };

type SupabaseServerClient = ReturnType<typeof createClient>;

// $ per credit - the metering unit is credits, not tokens or calls, so every feature's real
// token/model cost converts through this one constant. See the free-tier-ai-limiting-spec §3.
const CREDIT_VALUE_USD = 0.001;

/**
 * The single switch that flips every gateway call site from shadow to live enforcement at once
 * (spec §12/§14's "flip everything in one deliberate switch, not hand-edit a boolean in each
 * file"). A call site still passes `shadow: true` in its own code indefinitely - that flag's
 * meaning changes from "always let the call through" to "irrelevant, this env var already
 * decided" the moment this is true, with zero code edits anywhere else. Requires a deploy to
 * change, deliberately: this is a one-time migration cutover, not a runtime-tunable knob (compare
 * tier_quotas, which genuinely needs to change without a deploy).
 *
 * Flipping this to true is gated on all four items in the shadow-to-live checklist: the real
 * free-tier credit number is signed off, the limit-reached UI (spec §10/§15) exists, the
 * concurrency test in gateway.concurrency.integration.test.ts has been run against a real
 * Postgres, and the chokepoint lint rule is live (all confirmed separately - see PR history).
 */
const AI_GATEWAY_LIVE_ENFORCEMENT = process.env.AI_GATEWAY_LIVE_ENFORCEMENT === "true";

// Shadow mode's "effectively unlimited" quota (see GatewayCallParams.shadow). NOT
// Number.MAX_SAFE_INTEGER (2^53-1) - reserve_ai_credits' p_quota column is a Postgres `int`
// (int4, max 2,147,483,647), and passing a bigger value than that overflows with a real "value
// out of range for type integer" error, confirmed live against the actual deployed migration.
// One billion credits ($1M-equivalent) is functionally unlimited for any real call while staying
// safely inside int4 range.
export const SHADOW_MODE_QUOTA = 1_000_000_000;

// A logical call gets this many attempts (in addition to the first) before the reservation is
// refunded and the error propagates - bounds a broken call to a fixed, small amount of retried
// spend instead of an unbounded reserve-refund loop. Separate from (and layered on top of) each
// provider SDK's own internal retry-on-transient-error behaviour (see lib/anthropic/client.ts
// etc.) - that layer already retries a single physical request; this layer retries the whole
// logical call (build request -> call provider -> parse response) if the previous attempt threw
// for any reason, including a parse failure the SDK's own retry would never catch.
const MAX_GATEWAY_RETRIES = 2;

export class QuotaExceededError extends Error {
  constructor(
    public readonly tier: Plan,
    public readonly feature: string,
    /** Null for a 'lifetime' tier (free - spec §2): it never resets, so the UI must render the
     * terminal "you've used your free trial" copy from spec §10/§15, never a reset date. */
    public readonly resetsAt: Date | null
  ) {
    super(`AI quota exceeded for tier "${tier}" (feature "${feature}")`);
    this.name = "QuotaExceededError";
  }
}

/** Credits round up at reservation time (never let an estimate under-reserve) and round to the
 * nearest credit at commit time (fair accounting once the real cost is known), with a 1-credit
 * floor either way so a genuinely free-to-the-cent call still consumes something measurable. */
function creditsFromCostUsd(costUsd: number, rounding: "up" | "nearest"): number {
  const raw = costUsd / CREDIT_VALUE_USD;
  const rounded = rounding === "up" ? Math.ceil(raw) : Math.round(raw);
  return Math.max(1, rounded);
}

export type TierWindow = "lifetime" | "daily" | "monthly";

/** Start of the current window in UTC, or null for 'lifetime' (spec §2: free tier's allowance is
 * granted once per account and never resets - no window-start to compute, no cron to reset it).
 * Monthly resets on the 1st; a user-local-timezone reset was considered and deliberately not
 * built for the monthly case - it would mean each user's boundary falls at a different real-world
 * instant, which every window-start query here and in any future dashboard would need to account
 * for. UTC keeps one boundary, one query shape, everywhere. */
export function currentWindowStart(window: TierWindow): Date | null {
  if (window === "lifetime") return null;
  const now = new Date();
  if (window === "daily") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Null for 'lifetime' - there is no next reset to report (spec §10: never promise a reset date
 * on the free tier). Used only to populate QuotaExceededError.resetsAt for windowed tiers. */
export function nextWindowStart(window: TierWindow): Date | null {
  if (window === "lifetime") return null;
  const now = new Date();
  if (window === "daily") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

interface UsageResult {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}

export interface GatewayCallParams<T> {
  /** Request-scoped, authenticated client (lib/supabase/server.ts createClient()) - NEVER the
   * service-role client. reserve/commit/refund_ai_credits all check user_id = auth.uid() inside
   * the RPC, which only resolves correctly when called through the caller's own session. */
  supabase: SupabaseServerClient;
  userId: string;
  tier: Plan;
  feature: string;
  provider: AiProvider;
  model: string;
  /** Conservative (worst-case, not average) credit estimate for the pre-flight check - refused
   * before invoke() ever runs if the balance can't cover it. Get this wrong high and a call that
   * would have fit gets refused early (annoying, never unsafe); get it wrong low and a call that
   * shouldn't have started can still push the window over budget until its own commit corrects
   * the balance for the next call. */
  estimatedCredits: number;
  /** Migration aid, not a permanent feature (spec §12/§14): true while a call site is being
   * ported onto the gateway before its tier_quotas number is confirmed and some other mechanism
   * (an existing feature counter, or nothing yet) is still the real gate. Reservation and
   * commit/refund all still run for real - the ledger fills in with accurate cost data - but the
   * pre-flight check can never refuse the call, so this can only ever add metering, never a new
   * way to block a request the old gate would have allowed. Remove once the tier's real number is
   * confirmed and this call site is ready to enforce it. */
  shadow?: boolean;
  /** Makes the actual provider call. Receives nothing from the gateway - close over anthropic /
   * openai / gemini imported from this same module (see the re-export above) inside the caller. */
  invoke: () => Promise<T>;
  /** Pulls real token usage out of whatever invoke() returned, so callGateway can convert it to
   * $ (via the shared pricing table) and then to credits without knowing each SDK's response
   * shape itself. */
  extractUsage: (result: T) => UsageResult;
}

/**
 * The single chokepoint every AI feature calls through: authenticate -> resolve tier -> pre-flight
 * check -> reserve atomically -> invoke the provider -> reconcile actual cost -> commit (or, on
 * exhausted retries, refund). See supabase/migrations/20260907000000_ai_gateway_ledger.sql for the
 * atomic reserve/commit/refund RPCs this wraps, and the free-tier-ai-limiting-spec for the design.
 *
 * Throws QuotaExceededError (caught by the route, rendered as the structured "limit reached"
 * response from spec §14) when the pre-flight check fails - invoke() is never called in that
 * case. Never throws it when `shadow` is set (see GatewayCallParams.shadow). Any other throw
 * means every retry was exhausted; the reservation has already been refunded by the time it
 * propagates.
 */
export async function callGateway<T>(params: GatewayCallParams<T>): Promise<T> {
  const { supabase, userId, tier, feature, provider, model, estimatedCredits, shadow, invoke, extractUsage } = params;

  const { data: quotaRow, error: quotaError } = await supabase
    .from("tier_quotas")
    .select("credits_per_window, quota_window")
    .eq("tier", tier)
    .maybeSingle();
  if (quotaError) throw quotaError;
  // No row for this tier is a config bug, not a reason to let every call through unmetered -
  // fail closed (quota 0, monthly) rather than open. Shadow mode overrides that closed default
  // too, same as the real quota below - a call site being onboarded shouldn't start failing
  // outright just because tier_quotas isn't configured for it yet.
  const quota = quotaRow?.credits_per_window ?? 0;
  const window = (quotaRow?.quota_window as TierWindow | undefined) ?? "monthly";

  const windowStart = currentWindowStart(window);

  // Shadow mode: reserve against an effectively unlimited quota instead of the real one, so the
  // reservation always succeeds and the ledger still gets a real row with real reconciled cost -
  // it just can never be the thing that refuses a call. See GatewayCallParams.shadow. The global
  // AI_GATEWAY_LIVE_ENFORCEMENT switch overrides every call site's `shadow: true` at once - once
  // it's true, "shadow" stops meaning anything and every reservation checks the real quota.
  const effectiveQuota = shadow && !AI_GATEWAY_LIVE_ENFORCEMENT ? SHADOW_MODE_QUOTA : quota;

  const { data: ledgerId, error: reserveError } = await supabase.rpc("reserve_ai_credits", {
    p_user_id: userId,
    p_tier: tier,
    p_feature: feature,
    p_provider: provider,
    p_model: model,
    p_estimated_credits: estimatedCredits,
    p_window_start: windowStart ? windowStart.toISOString() : null,
    p_quota: effectiveQuota,
  });
  if (reserveError) throw reserveError;
  if (!ledgerId) {
    throw new QuotaExceededError(tier, feature, nextWindowStart(window));
  }

  let lastError: unknown;
  let result: T | undefined;
  let invokeSucceeded = false;

  for (let attempt = 0; attempt <= MAX_GATEWAY_RETRIES; attempt += 1) {
    try {
      result = await invoke();
      invokeSucceeded = true;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!invokeSucceeded) {
    // Every attempt failed - release the reservation. Best-effort: if the refund RPC itself
    // fails, the 10-minute staleness window in reserve_ai_credits still reclaims these credits
    // rather than locking them forever (see that function's comment).
    await supabase.rpc("refund_ai_credits", { p_ledger_id: ledgerId, p_user_id: userId }).then(
      () => {},
      (refundError) => console.error("callGateway: refund_ai_credits failed", refundError)
    );
    throw lastError;
  }

  // Committing is deliberately outside the retry loop above: invoke() already succeeded (and, for
  // a paid provider, already spent real money) by this point, so a commit failure must never
  // trigger a second real provider call the way it did when this lived inside the same try/catch
  // - that bug meant a transient Supabase blip on the bookkeeping step could re-run an already-
  // successful, already-billed call, then still refund the reservation and throw to the user even
  // though the provider succeeded one or more times. Committing is now best-effort, like refund
  // above: the caller gets its real result regardless of whether the ledger write succeeds, and a
  // failure here is logged (and self-heals via the same 10-minute staleness window) rather than
  // silently swallowed - the RPC's own `{ data, error }` result was previously never checked.
  const usage = extractUsage(result as T);
  const costUsd = estimateCostUsd(
    provider,
    model,
    usage.inputTokens,
    usage.outputTokens,
    usage.cacheCreationInputTokens ?? 0,
    usage.cacheReadInputTokens ?? 0
  );

  const { error: commitError } = await supabase.rpc("commit_ai_credits", {
    p_ledger_id: ledgerId,
    p_user_id: userId,
    p_credits_actual: creditsFromCostUsd(costUsd, "nearest"),
    p_input_tokens: usage.inputTokens,
    p_output_tokens: usage.outputTokens,
    p_cache_creation_input_tokens: usage.cacheCreationInputTokens ?? 0,
    p_cache_read_input_tokens: usage.cacheReadInputTokens ?? 0,
    p_cost_usd: costUsd,
  });
  if (commitError) {
    console.error("callGateway: commit_ai_credits failed - ledger row stays 'reserved' until the 10-minute staleness window reclaims it", commitError);
  }

  return result as T;
}

export { creditsFromCostUsd };
