import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

export const FREE_RESUME_LIMIT = 2;
export const FREE_ASSIST_LIMIT_PER_RESUME = 10;
export const FREE_CONTENT_SCORE_LIMIT_PER_RESUME = 1;

export class UnauthorizedError extends Error {}
export class FreeLimitReachedError extends Error {}
export class PaidFeatureError extends Error {}
export class AssistLimitReachedError extends Error {}
export class ContentScoreLimitReachedError extends Error {}
export class ForbiddenError extends Error {}

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

/**
 * Every admin route must call this itself — never trust a client-supplied "isAdmin" flag or an
 * admin check performed only in the page that links to the route. is_admin is read via the
 * caller's own RLS-scoped row (not client-writable — see supabase/schema.sql column-privilege
 * lockdown), so this is a genuine server-side check, not a client-controlled one.
 */
export async function requireAdmin(): Promise<{ authUserId: string; appUser: AppUser }> {
  const result = await requireUser();
  if (!result.appUser.is_admin) {
    throw new ForbiddenError("Admin access required");
  }
  return result;
}

export function assertPaidPlan(appUser: AppUser) {
  if (appUser.plan === "free") {
    throw new PaidFeatureError("This feature requires Pro or Lifetime");
  }
}

/**
 * Atomically reserves one resume-generation slot via the increment_resumes_used Postgres
 * function (check-and-increment in a single round trip), instead of a racy
 * read-then-compare-then-write. Throws FreeLimitReachedError if the free-tier cap is hit.
 */
export async function reserveResumeGeneration(
  supabase: SupabaseServerClient,
  appUser: AppUser
): Promise<void> {
  const limit = appUser.plan === "free" ? FREE_RESUME_LIMIT : null;
  const { data, error } = await supabase.rpc("increment_resumes_used", {
    p_user_id: appUser.id,
    p_limit: limit,
  });

  if (error) throw error;
  if (!data) throw new FreeLimitReachedError("Free resume limit reached");
}

/** Best-effort refund of a reserved resume-generation slot after a failed generation. */
export async function refundResumeGeneration(
  supabase: SupabaseServerClient,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("decrement_resumes_used", { p_user_id: userId });
  if (error) {
    console.error("decrement_resumes_used RPC failed", error);
  }
}

/**
 * Atomically reserves one AI-assist call for a resume via the increment_assist_calls
 * Postgres function. Throws AssistLimitReachedError if the free-tier per-resume cap is hit.
 */
export async function reserveAssistCall(
  supabase: SupabaseServerClient,
  appUser: AppUser,
  resumeId: string
): Promise<void> {
  const limit = appUser.plan === "free" ? FREE_ASSIST_LIMIT_PER_RESUME : null;
  const { data, error } = await supabase.rpc("increment_assist_calls", {
    p_resume_id: resumeId,
    p_limit: limit,
  });

  if (error) throw error;
  if (!data) throw new AssistLimitReachedError("AI-assist limit reached for this resume");
}

/** Best-effort refund of a reserved assist call after a failed assist request. */
export async function refundAssistCall(
  supabase: SupabaseServerClient,
  resumeId: string
): Promise<void> {
  const { error } = await supabase.rpc("decrement_assist_calls", { p_resume_id: resumeId });
  if (error) {
    console.error("decrement_assist_calls RPC failed", error);
  }
}

/**
 * Atomically reserves one content-score run for a resume via the
 * increment_content_score_count Postgres function. Throws ContentScoreLimitReachedError if
 * the free-tier per-resume cap (1, ever) is hit.
 */
export async function reserveContentScore(
  supabase: SupabaseServerClient,
  appUser: AppUser,
  resumeId: string
): Promise<void> {
  const limit = appUser.plan === "free" ? FREE_CONTENT_SCORE_LIMIT_PER_RESUME : null;
  const { data, error } = await supabase.rpc("increment_content_score_count", {
    p_resume_id: resumeId,
    p_limit: limit,
  });

  if (error) throw error;
  if (!data) throw new ContentScoreLimitReachedError("Content score limit reached for this resume");
}

/** Best-effort refund of a reserved content-score run after a failed scoring attempt. */
export async function refundContentScore(
  supabase: SupabaseServerClient,
  resumeId: string
): Promise<void> {
  const { error } = await supabase.rpc("decrement_content_score_count", { p_resume_id: resumeId });
  if (error) {
    console.error("decrement_content_score_count RPC failed", error);
  }
}
