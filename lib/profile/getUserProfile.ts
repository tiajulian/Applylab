import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

/**
 * The signed-in user's profile row, fetched once per request: the dashboard layout (sidebar's
 * completion %) and the home page both need it, and React's cache() dedupes the second call.
 */
export const getUserProfile = cache(async (userId: string): Promise<UserProfile | null> => {
  const supabase = createClient();
  const { data } = await supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as UserProfile | null) ?? null;
});
