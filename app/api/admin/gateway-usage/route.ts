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

    // Ledger is expected to stay small during shadow mode (no route depends on it for
    // enforcement yet) - a plain unpaginated select is fine here, same as api_cost_log's
    // equivalent query in the existing analytics route. Revisit with pagination once real
    // (non-shadow) volume lands.
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("ai_usage_ledger")
      .select("user_id, tier, feature, credits_actual, credits_reserved, status, cost_usd, created_at");
    if (ledgerError) throw ledgerError;
    const allRows = ledgerRows ?? [];

    const byStatus: Record<string, number> = {};
    const featureMap = new Map<string, { calls: number; creditsCommitted: number; costUsd: number }>();
    const tierMap = new Map<string, { calls: number; creditsCommitted: number; costUsd: number }>();
    const userMap = new Map<string, { creditsCommitted: number; calls: number }>();
    let staleReservationCount = 0;
    const staleThreshold = new Date(Date.now() - STALE_RESERVATION_MINUTES * 60 * 1000).toISOString();

    for (const row of allRows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

      if (row.status === "reserved" && row.created_at < staleThreshold) {
        staleReservationCount += 1;
      }

      // Only committed rows carry a real reconciled cost/credit figure - reserved/refunded/failed
      // rows are excluded from these sums the same way reserve_ai_credits' own balance query
      // treats them (see that function's status filter).
      if (row.status !== "committed") continue;
      const credits = Number(row.credits_actual ?? 0);
      const costUsd = Number(row.cost_usd ?? 0);

      const feat = featureMap.get(row.feature) ?? { calls: 0, creditsCommitted: 0, costUsd: 0 };
      featureMap.set(row.feature, {
        calls: feat.calls + 1,
        creditsCommitted: feat.creditsCommitted + credits,
        costUsd: feat.costUsd + costUsd,
      });

      const tierStat = tierMap.get(row.tier) ?? { calls: 0, creditsCommitted: 0, costUsd: 0 };
      tierMap.set(row.tier, {
        calls: tierStat.calls + 1,
        creditsCommitted: tierStat.creditsCommitted + credits,
        costUsd: tierStat.costUsd + costUsd,
      });

      if (row.user_id) {
        const userStat = userMap.get(row.user_id) ?? { creditsCommitted: 0, calls: 0 };
        userMap.set(row.user_id, {
          creditsCommitted: userStat.creditsCommitted + credits,
          calls: userStat.calls + 1,
        });
      }
    }

    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1].creditsCommitted - a[1].creditsCommitted)
      .slice(0, 10)
      .map(([userId]) => userId);

    const { data: topUserRows } = topUserIds.length
      ? await supabase.from("users").select("id, email, plan").in("id", topUserIds)
      : { data: [] as Array<{ id: string; email: string; plan: Plan }> };
    const userLookup = new Map((topUserRows ?? []).map((u) => [u.id, u]));

    const topUsersByCredits = topUserIds.map((userId) => {
      const stat = userMap.get(userId)!;
      const user = userLookup.get(userId);
      return {
        userId,
        email: user?.email ?? "Unknown",
        plan: (user?.plan ?? "free") as Plan,
        creditsCommitted: stat.creditsCommitted,
        calls: stat.calls,
      };
    });

    const payload: AdminGatewayUsageData = {
      circuitBreaker,
      tierQuotas,
      ledgerSummary: {
        totalRows: allRows.length,
        byStatus,
        byFeature: Array.from(featureMap.entries())
          .map(([feature, stat]) => ({
            feature,
            calls: stat.calls,
            creditsCommitted: stat.creditsCommitted,
            costAud: stat.costUsd * USD_TO_AUD,
          }))
          .sort((a, b) => b.creditsCommitted - a.creditsCommitted),
        byTier: Array.from(tierMap.entries())
          .map(([tier, stat]) => ({
            tier,
            calls: stat.calls,
            creditsCommitted: stat.creditsCommitted,
            costAud: stat.costUsd * USD_TO_AUD,
          }))
          .sort((a, b) => b.creditsCommitted - a.creditsCommitted),
      },
      topUsersByCredits,
      staleReservationCount,
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
