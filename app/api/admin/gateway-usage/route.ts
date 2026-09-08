import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ForbiddenError, requireAdmin, UnauthorizedError } from "@/lib/requireUser";
import { checkCircuitBreaker, type CircuitBreakerCheck } from "@/lib/aiGateway/circuitBreaker";
import type { Plan } from "@/types";

export const dynamic = "force-dynamic";

const USD_TO_AUD = 1.54;
// Matches reserve_ai_credits' own staleness window (supabase/migrations/
// 20260907000000_ai_gateway_ledger.sql) - a 'reserved' row still open past this is overwhelmingly
// an orphan (crashed request), not a slow in-flight call, and is already excluded from balance
// checks there. Surfaced here so a growing count is visible before it needs investigating.
const STALE_RESERVATION_MINUTES = 10;

export interface AdminGatewayUsageData {
  circuitBreaker: CircuitBreakerCheck;
  tierQuotas: Array<{
    tier: string;
    creditsPerWindow: number;
    quotaWindow: string;
    maxFanoutPerCall: number | null;
  }>;
  ledgerSummary: {
    totalRows: number;
    byStatus: Record<string, number>;
    byFeature: Array<{ feature: string; calls: number; creditsCommitted: number; costAud: number }>;
    byTier: Array<{ tier: string; calls: number; creditsCommitted: number; costAud: number }>;
  };
  topUsersByCredits: Array<{
    userId: string;
    email: string;
    plan: Plan;
    creditsCommitted: number;
    calls: number;
  }>;
  staleReservationCount: number;
}

interface LedgerSummaryRpcResult {
  totalRows: number;
  byStatus: Record<string, number>;
  byFeature: Array<{ feature: string; calls: number; creditsCommitted: number; costUsd: number }>;
  byTier: Array<{ tier: string; calls: number; creditsCommitted: number; costUsd: number }>;
  topUsers: Array<{ userId: string; email: string | null; plan: Plan | null; creditsCommitted: number; calls: number }>;
  staleReservationCount: number;
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceRoleClient();

    const circuitBreaker = await checkCircuitBreaker(supabase);

    const { data: tierQuotasRaw, error: tierQuotasError } = await supabase
      .from("tier_quotas")
      .select("tier, credits_per_window, quota_window, max_fanout_per_call");
    if (tierQuotasError) throw tierQuotasError;

    const tierQuotas = (tierQuotasRaw ?? []).map((row) => ({
      tier: row.tier,
      creditsPerWindow: row.credits_per_window,
      quotaWindow: row.quota_window,
      maxFanoutPerCall: row.max_fanout_per_call,
    }));

    // Every byStatus/byFeature/byTier/topUsers breakdown below is computed in a single SQL
    // GROUP BY per breakdown (see the migration) instead of pulling every ledger row into Node
    // and reducing it here - scales with distinct features/tiers/users, not with total calls ever
    // made.
    // A scalar-returning RPC (this function returns `json`, not `setof`/`table`) comes back as
    // the JSON value itself, not a row array - no .single() needed (and .single() expects an
    // array response, so calling it here would be wrong for this shape).
    const { data: summaryRaw, error: summaryError } = await supabase.rpc("admin_ai_gateway_ledger_summary", {
      p_stale_minutes: STALE_RESERVATION_MINUTES,
    });
    if (summaryError) throw summaryError;
    const summary = summaryRaw as unknown as LedgerSummaryRpcResult;

    const payload: AdminGatewayUsageData = {
      circuitBreaker,
      tierQuotas,
      ledgerSummary: {
        totalRows: summary.totalRows,
        byStatus: summary.byStatus,
        byFeature: summary.byFeature.map((row) => ({
          feature: row.feature,
          calls: row.calls,
          creditsCommitted: row.creditsCommitted,
          costAud: row.costUsd * USD_TO_AUD,
        })),
        byTier: summary.byTier.map((row) => ({
          tier: row.tier,
          calls: row.calls,
          creditsCommitted: row.creditsCommitted,
          costAud: row.costUsd * USD_TO_AUD,
        })),
      },
      topUsersByCredits: summary.topUsers.map((row) => ({
        userId: row.userId,
        email: row.email ?? "Unknown",
        plan: row.plan ?? "free",
        creditsCommitted: row.creditsCommitted,
        calls: row.calls,
      })),
      staleReservationCount: summary.staleReservationCount,
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("admin gateway-usage error", error);
    const message = error instanceof Error ? error.message : "Failed to load AI gateway usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
