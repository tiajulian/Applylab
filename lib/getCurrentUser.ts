import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export async function getCurrentUser(): Promise<{
  authUserId: string;
  authEmail: string;
  appUser: AppUser | null;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    authUserId: user.id,
    authEmail: user.email ?? "",
    appUser: appUser as AppUser | null,
  };
}
