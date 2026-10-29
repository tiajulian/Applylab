import type { createClient } from "@/lib/supabase/server";
import { hashForScoring } from "./scoreCache";
import type { ReviewSkillGap } from "./reviewSkillGap";
import type { SkillsBridgeItem } from "@/types";

/** Only the explicitly linked analysis for this exact job, read under the user's RLS. */
export async function fetchReviewSkillGap(
  supabase: ReturnType<typeof createClient>,
  resume: { skills_bridge_id?: string | null; job_description?: string | null },
  userId: string,
): Promise<ReviewSkillGap | null> {
  if (!resume.skills_bridge_id || !resume.job_description?.trim()) return null;
  const { data: bridge, error } = await supabase.from("skills_bridges")
    .select("*").eq("id", resume.skills_bridge_id).eq("user_id", userId).maybeSingle();
  if (error || !bridge || (bridge.job_ad_hash ?? bridge.job_description_hash) !== hashForScoring(resume.job_description)) return null;
  const { data: items, error: itemsError } = await supabase.from("skills_bridge_items")
    .select("*").eq("bridge_id", bridge.id).order("id");
  if (itemsError) return null;
  return { bridgeId: bridge.id, items: (items ?? []) as SkillsBridgeItem[] };
}
