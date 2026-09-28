import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdzunaLimits } from "@/lib/jobs/config";
import type { CallBudget, ConsumeResult, UsageWindow } from "@/lib/jobs/adzuna/client";

interface ConsumeRow {
  allowed: boolean;
  blocked_window: UsageWindow | null;
  minute_count: number;
  day_count: number;
  week_count: number;
  month_count: number;
}

/** CallBudget backed by public.adzuna_consume_call() (atomic across concurrent callers). */
export function createSupabaseCallBudget(supabase: SupabaseClient, limits: AdzunaLimits): CallBudget {
  return {
    async consume(): Promise<ConsumeResult> {
      const { data, error } = await supabase.rpc("adzuna_consume_call", {
        p_provider: "adzuna",
        p_limit_minute: limits.minute,
        p_limit_day: limits.day,
        p_limit_week: limits.week,
        p_limit_month: limits.month,
      });
      if (error) throw new Error(`adzuna_consume_call failed: ${error.message}`);
      const row = (data as ConsumeRow[])[0];
      const counts = {
        minute: row.minute_count,
        day: row.day_count,
        week: row.week_count,
        month: row.month_count,
      };
      return row.allowed ? { allowed: true, counts } : { allowed: false, window: row.blocked_window!, counts };
    },
  };
}
