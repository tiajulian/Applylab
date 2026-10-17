import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ScorableProfile } from "@/lib/profile/completeness";

export type ProfileForScoring = Omit<ScorableProfile, "fullName">;

const SCORABLE_COLUMNS =
  "work_rights, phone, location, linkedin_url, work_experience, education, skills, referees, raw_linkedin_paste";

/**
 * The signed-in user's profile (the columns the completeness score reads), fetched once per
 * request: the dashboard layout (sidebar's completion %) and the home page both need it, and
 * React's cache() dedupes the second call. Throws on a database error so callers can tell "no
 * profile yet" (null) apart from "couldn't load it".
 */
export const getUserProfile = cache(async (userId: string): Promise<ProfileForScoring | null> => {
  const { data, error } = await createClient()
    .from("user_profiles")
    .select(SCORABLE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileForScoring | null) ?? null;
});
