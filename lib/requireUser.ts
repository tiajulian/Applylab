import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

import {
  FREE_RESUME_LIMIT,
  FREE_ASSIST_LIMIT_PER_RESUME,
  FREE_CONTENT_SCORE_LIMIT_PER_RESUME,
  FREE_TIER_FEATURE_LIMITS,
  type FreeTierLimitedFeature,
} from "@/lib/limits";
import { FEATURE_LABELS } from "@/lib/marketing/copy";

type SupabaseServerClient = ReturnType<typeof createClient>;

// Limits live in lib/limits.ts (dependency-free, so client components can import them too).
export {
  FREE_RESUME_LIMIT,
  FREE_ASSIST_LIMIT_PER_RESUME,
  FREE_CONTENT_SCORE_LIMIT_PER_RESUME,
  FREE_TIER_FEATURE_LIMITS,
  type FreeTierLimitedFeature,
} from "@/lib/limits";

export class UnauthorizedError extends Error {}
export class FreeLimitReachedError extends Error {}
export class PaidFeatureError extends Error {}
export class AssistLimitReachedError extends Error {}
export class ContentScoreLimitReachedError extends Error {}
export class ForbiddenError extends Error {}

export class FreeTierFeatureLimitReachedError extends Error {
  constructor(
    public readonly feature: FreeTierLimitedFeature,
    public readonly limit: number
  ) {
    super(`Free-tier limit reached for feature "${feature}" (${limit})`);
    this.name = "FreeTierFeatureLimitReachedError";
  }
}

/**
 * Pass the incoming Request when the caller might be the Chrome extension's background
 * service worker rather than the web app: its fetch() is cross-site, so browsers withhold
 * the SameSite=Lax session cookie regardless of credentials: 'include', and it sends an
 * `Authorization: Bearer <access_token>` header instead (relayed from the web app via
 * components/extension/ExtensionAuthBridge.tsx). supabase.auth.getUser(jwt) verifies that
 * token directly against Supabase Auth rather than reading the (absent) session cookie.
 */
export async function requireUser(
  request?: Request
): Promise<{ authUserId: string; appUser: AppUser; isAnonymous: boolean }> {
  const supabase = createClient();
  const bearerToken = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  const {
    data: { user },
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

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

  return {
    authUserId: user.id,
    appUser: appUser as AppUser,
    isAnonymous: Boolean(user.is_anonymous),
  };
}

/**
 * Ensures the caller is signed in with a permanent (non-anonymous) account before allowing
 * access to expensive AI generation features, applications, or permanent data persistence.
 */
export async function requirePermanentUser(
  request?: Request
): Promise<{ authUserId: string; appUser: AppUser }> {
  const result = await requireUser(request);
  if (result.isAnonymous) {
    throw new UnauthorizedError("Permanent account required");
  }
  return { authUserId: result.authUserId, appUser: result.appUser };
}

/**
 * Every admin route must call this itself — never trust a client-supplied "isAdmin" flag or an
 * admin check performed only in the page that links to the route. is_admin is read via the
 * caller's own RLS-scoped row (not client-writable — see supabase/schema.sql column-privilege
 * lockdown), so this is a genuine server-side check, not a client-controlled one.
 */
export async function requireAdmin(): Promise<{ authUserId: string; appUser: AppUser }> {
  const result = await requirePermanentUser();
  if (!result.appUser.is_admin) {
    throw new ForbiddenError("Admin access required");
  }
  return result;
}

export function assertPaidPlan(appUser: AppUser) {
  if (appUser.plan === "free") {
    throw new PaidFeatureError("This feature requires Pro");
  }
}

/**
 * Whether the user may download a resume (and the cover letters that belong to it). True for:
 * 1. Pro users;
 * 2. their own free-allowance resume (resumes.is_free_allowance, set only by the server when a
 *    free user generates within FREE_RESUME_LIMIT);
 * 3. a one-time single-resume unlock recorded in public.resume_unlocks.
 * The export routes (via assertResumeExportEntitlement) and the pages that set the download
 * button's state both call this, so the button can never disagree with the server.
 */
export async function canExportResume(
  supabase: SupabaseServerClient,
  appUser: AppUser,
  resumeId: string
): Promise<boolean> {
  if (appUser.plan === "pro") {
    return true;
  }

  const [{ data: resume, error: resumeError }, { data: unlock, error: unlockError }] = await Promise.all([
    supabase
      .from("resumes")
      .select("is_free_allowance")
      .eq("id", resumeId)
      .eq("user_id", appUser.id)
      .maybeSingle(),
    supabase
      .from("resume_unlocks")
      .select("id")
      .eq("user_id", appUser.id)
      .eq("resume_id", resumeId)
      .maybeSingle(),
  ]);

  const error = resumeError ?? unlockError;
  if (error) {
    console.error("error checking resume export entitlement", error);
    throw error;
  }

  return Boolean(resume?.is_free_allowance) || Boolean(unlock);
}

/** Throws PaidFeatureError unless canExportResume allows the download. */
export async function assertResumeExportEntitlement(
  supabase: SupabaseServerClient,
  appUser: AppUser,
  resumeId: string
): Promise<void> {
  if (!(await canExportResume(supabase, appUser, resumeId))) {
    throw new PaidFeatureError("This resume requires Pro or a one-time unlock to download");
  }
}

/**
 * Marks a just-created resume as the free user's download-included resume. Runs with the service
 * role because users can't write is_free_allowance themselves (an insert trigger forces it false,
 * and it isn't in the column update grant). Retried once; a persistent failure is logged and leaves
 * the resume locked rather than failing a generation that already succeeded.
 */
export async function markFreeAllowanceResume(appUser: AppUser, resumeId: string): Promise<void> {
  if (appUser.plan !== "free") return;
  const service = createServiceRoleClient();
  // One retry: the insert just succeeded, so a failure here is almost always a transient blip,
  // and a missed mark would leave the user's only free resume locked.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await service
      .from("resumes")
      .update({ is_free_allowance: true })
      .eq("id", resumeId)
      .eq("user_id", appUser.id);
    if (!error) return;
    console.error(`failed to mark free-allowance resume (attempt ${attempt})`, error);
    // A constraint violation (e.g. they already have a free-allowance resume) won't change on retry.
    if (String(error.code ?? "").startsWith("23")) return;
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 300));
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

// Refunds run with the service role: the decrement_* RPCs are server-only so a user can't call
// them directly to undo their own usage (see 20260930040000_server_only_refunds.sql). Callers pass
// the already-authenticated user id.

/** Best-effort refund of a reserved resume-generation slot after a failed generation. */
export async function refundResumeGeneration(userId: string): Promise<void> {
  const { error } = await createServiceRoleClient().rpc("decrement_resumes_used", { p_user_id: userId });
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
export async function refundAssistCall(userId: string, resumeId: string): Promise<void> {
  const { error } = await createServiceRoleClient().rpc("decrement_assist_calls", {
    p_resume_id: resumeId,
    p_user_id: userId,
  });
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
export async function refundContentScore(userId: string, resumeId: string): Promise<void> {
  const { error } = await createServiceRoleClient().rpc("decrement_content_score_count", {
    p_resume_id: resumeId,
    p_user_id: userId,
  });
  if (error) {
    console.error("decrement_content_score_count RPC failed", error);
  }
}

/**
 * Atomically reserves one lifetime-per-account use of a free-tier-limited feature (see
 * FREE_TIER_FEATURE_LIMITS) via increment_free_tier_feature_usage. Pro users pass no real limit
 * and can never be refused here. Throws FreeTierFeatureLimitReachedError if the free-tier cap for
 * that feature is hit - call refundFreeTierFeature on any failure after this succeeds, same
 * reserve-before-spend shape as reserveResumeGeneration/reserveAssistCall.
 */
export async function reserveFreeTierFeature(
  supabase: SupabaseServerClient,
  appUser: AppUser,
  feature: FreeTierLimitedFeature
): Promise<void> {
  const limit = appUser.plan === "free" ? FREE_TIER_FEATURE_LIMITS[feature] : null;
  const { data, error } = await supabase.rpc("increment_free_tier_feature_usage", {
    p_user_id: appUser.id,
    p_feature: feature,
    p_limit: limit,
  });

  if (error) throw error;
  if (!data) throw new FreeTierFeatureLimitReachedError(feature, FREE_TIER_FEATURE_LIMITS[feature]);
}

/** Best-effort refund of a reserved free-tier feature use after a failed generation. */
export async function refundFreeTierFeature(userId: string, feature: FreeTierLimitedFeature): Promise<void> {
  const { error } = await createServiceRoleClient().rpc("decrement_free_tier_feature_usage", {
    p_user_id: userId,
    p_feature: feature,
  });
  if (error) {
    console.error("decrement_free_tier_feature_usage RPC failed", error);
  }
}

/**
 * The { error, code: "FREE_LIMIT_REACHED", limit } 403 response every hard-capped free-tier route
 * was building by hand from a caught FreeTierFeatureLimitReachedError - was copy-pasted (with a
 * per-feature message swapped in) across ~9 routes.
 */
export function freeTierLimitReachedResponse(error: FreeTierFeatureLimitReachedError): NextResponse {
  return NextResponse.json(
    {
      // User-facing names shared with the dashboard usage meters (lib/marketing/copy.ts).
      error: `Free ${FEATURE_LABELS[error.feature].singular} limit reached`,
      code: "FREE_LIMIT_REACHED",
      limit: error.limit,
    },
    { status: 403 }
  );
}

/**
 * Tracks whether a reserveFreeTierFeature call for `feature` actually succeeded in this request,
 * so a route's outer catch (which may run before or after the reservation happened) or an early
 * soft-failure branch can refund it without re-deriving "was this actually reserved" itself -
 * replaces the `reserved`/`reservedForUserId` variable pair every ported route was managing by
 * hand alongside its own `if (reserved && reservedForUserId)` check.
 */
export function trackFreeTierReservation(feature: FreeTierLimitedFeature) {
  let reservedUserId: string | null = null;
  return {
    markReserved(userId: string): void {
      reservedUserId = userId;
    },
    async refundIfReserved(): Promise<void> {
      if (!reservedUserId) return;
      const userId = reservedUserId;
      reservedUserId = null;
      await refundFreeTierFeature(userId, feature).catch((refundError) =>
        console.error(`failed to refund ${feature} reservation`, refundError)
      );
    },
  };
}
