import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createClient>;

/**
 * A user counts as "first run" once onboarded but before they've ever generated a resume or
 * logged an application. resumes_used is the lifetime generation counter (not the current
 * resumes row count), so deleting resumes back to zero doesn't re-trigger this for someone
 * who has already generated before.
 */
export async function isFirstRunUser(
  supabase: SupabaseServerClient,
  authUserId: string,
  resumesUsed: number
): Promise<boolean> {
  if (resumesUsed > 0) return false;

  const { count, error } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authUserId);

  // fail safe: an errored or unknown count is NOT first-run — misrouting a returning user
  // into the matcher on a transient DB error is worse than them landing on the dashboard.
  if (error || count == null) return false;

  return count === 0;
}
