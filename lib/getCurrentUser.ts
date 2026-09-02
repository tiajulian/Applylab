import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export async function getCurrentUser(): Promise<{
  authUserId: string;
  authEmail: string;
  isAnonymous: boolean;
  avatarUrl: string | null;
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

  const metadata = user.user_metadata ?? {};

  return {
    authUserId: user.id,
    authEmail: user.email ?? "",
    isAnonymous: Boolean(user.is_anonymous),
    avatarUrl: (metadata.avatar_url as string | undefined) || (metadata.picture as string | undefined) || null,
    appUser: appUser as AppUser | null,
  };
}
