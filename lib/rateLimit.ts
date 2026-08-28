import { createServiceRoleClient } from "@/lib/supabase/server";

type SupabaseServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Checks if a rate key has exceeded maxHits within windowMs.
 * If under the limit, records a hit in public.rate_limit_hits and returns true.
 * If at or over the limit, returns false without inserting.
 */
export async function checkAndRecordRateLimit(
  supabase: SupabaseServiceRoleClient,
  rateKey: string,
  maxHits: number,
  windowMs: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count, error } = await supabase
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("rate_key", rateKey)
    .gte("created_at", windowStart);

  if (error) {
    console.error("checkAndRecordRateLimit query error", error);
  }

  if ((count ?? 0) >= maxHits) {
    return false;
  }

  const { error: insertError } = await supabase
    .from("rate_limit_hits")
    .insert({ rate_key: rateKey });

  if (insertError) {
    console.error("checkAndRecordRateLimit insert error", insertError);
  }

  return true;
}
