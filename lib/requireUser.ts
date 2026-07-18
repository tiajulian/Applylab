import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export const FREE_RESUME_LIMIT = 2;

export class UnauthorizedError extends Error {}
export class FreeLimitReachedError extends Error {}
export class PaidFeatureError extends Error {}

export async function requireUser(): Promise<{ authUserId: string; appUser: AppUser }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new UnauthorizedError("Not authenticated");
  }

  const { data: appUser, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !appUser) {
    throw new UnauthorizedError("User record not found");
  }

  return { authUserId: user.id, appUser: appUser as AppUser };
}

export function assertWithinFreeLimit(appUser: AppUser) {
  if (appUser.plan === "free" && appUser.resumes_used >= FREE_RESUME_LIMIT) {
    throw new FreeLimitReachedError("Free resume limit reached");
  }
}

export function assertPaidPlan(appUser: AppUser) {
  if (appUser.plan === "free") {
    throw new PaidFeatureError("This feature requires Pro or Lifetime");
  }
}
