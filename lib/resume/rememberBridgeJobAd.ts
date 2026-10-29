import type { createClient } from "@/lib/supabase/server";
import { hashForScoring } from "./scoreCache";

/** Optional metadata: older databases must still be able to create/reuse Skill Gap checks. */
export async function rememberBridgeJobAd(
  supabase: ReturnType<typeof createClient>, bridgeId: string, userId: string, sourceHash: string, jobAd: string,
): Promise<void> {
  try {
    const { error } = await supabase.from("skills_bridges").update({ job_ad_hash: hashForScoring(jobAd) })
      .eq("id", bridgeId).eq("user_id", userId).eq("job_description_hash", sourceHash);
    if (error && error.code !== "PGRST204" && error.code !== "42703") console.error("Could not link Skill Gap job context", error);
  } catch (error) {
    console.error("Could not link Skill Gap job context", error);
  }
}
