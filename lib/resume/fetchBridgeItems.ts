import { createClient } from "@/lib/supabase/server";
import type { SkillsBridgeItem } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

/** Plain query, no ownership/validation logic - callers that need to validate a client-supplied
 * bridgeId first (e.g. app/api/generate-resume/route.ts's fetchBridgeContext) do that themselves
 * before calling this; this just fetches the items for an already-resolved bridge id, shared so
 * the honesty-fix route (app/api/resume/[id]/fix/route.ts) re-checks against the exact same rows
 * generation-time fact-checking would see, rather than a second, possibly-diverging query. */
export async function fetchBridgeItemsById(
  supabase: SupabaseServerClient,
  bridgeId: string
): Promise<SkillsBridgeItem[]> {
  const { data: items } = await supabase.from("skills_bridge_items").select("*").eq("bridge_id", bridgeId);
  return (items ?? []) as SkillsBridgeItem[];
}
