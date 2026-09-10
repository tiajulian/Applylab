import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export interface CurrentUser {
  authUserId: string;
  authEmail: string;
  isAnonymous: boolean;
  avatarUrl: string | null;
  appUser: AppUser | null;
}

interface AuthIdentity {
  id: string;
  email: string;
  isAnonymous: boolean;
  avatarUrl: string | null;
}

// middleware.ts already calls auth.getUser() for every request and forwards the result via
// these headers, so we read them here instead of paying for a second Supabase Auth
// round-trip on every page render.
async function resolveAuthIdentity(): Promise<AuthIdentity | null> {
  const headerList = headers();
  const uid = headerList.get("x-al-uid");

  if (uid === null) {
    // Header missing means middleware didn't run for this request (its matcher covers
    // everything but static assets, so this shouldn't happen) - verify directly rather
    // than silently treating the user as logged out.
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const metadata = user.user_metadata ?? {};
    return {
      id: user.id,
      email: user.email ?? "",
      isAnonymous: Boolean(user.is_anonymous),
      avatarUrl: (metadata.avatar_url as string | undefined) || (metadata.picture as string | undefined) || null,
    };
  }

  if (uid === "") return null;

  const avatarHeader = headerList.get("x-al-avatar");
  return {
    id: uid,
    email: headerList.get("x-al-email") ?? "",
    isAnonymous: headerList.get("x-al-anon") === "1",
    avatarUrl: avatarHeader ? decodeURIComponent(avatarHeader) || null : null,
  };
}

// Memoized per-request: the (dashboard) layout and every page under it each call this
// independently, which without caching means a duplicate `users` table query on every
// single navigation.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const authUser = await resolveAuthIdentity();
  if (!authUser) return null;

  const supabase = createClient();
  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return {
    authUserId: authUser.id,
    authEmail: authUser.email,
    isAnonymous: authUser.isAnonymous,
    avatarUrl: authUser.avatarUrl,
    appUser: appUser as AppUser | null,
  };
});
