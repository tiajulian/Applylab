import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

export const FREE_RESUME_LIMIT = 2;
export const FREE_ASSIST_LIMIT_PER_RESUME = 10;
export const FREE_CONTENT_SCORE_LIMIT_PER_RESUME = 1;

/**
 * Lifetime-per-account caps for AI features that previously had only an hourly anti-abuse
 * stopgap (see supabase/migrations/20260907020000_free_tier_feature_limits.sql's own header) and
 * no real free-tier account limit the way resumes/assist already did. PLACEHOLDER VALUES, same
 * status as tier_quotas' credit numbers - reasonable starting points, not measured against real
 * conversion data, easy to tune here without touching the RPC or any call site. Pro users pass
 * `null` as the limit at the call site (see reserveFreeTierFeature) and are never capped by this.
 */
export const FREE_TIER_FEATURE_LIMITS = {
  "cover-letter": 2,
  "followup-draft": 3,
  "extract-skills": 10,
  "resume-review": 2,
  "win-polish": 15,
  "win-starters": 15,
  "role-duties-suggest": 10,
  "role-duties-bulletify": 10,
  "project-enhance": 5,
  "skills-bridge": 2,
  copilot: 20,
} as const;

export type FreeTierLimitedFeature = keyof typeof FREE_TIER_FEATURE_LIMITS;

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
 * Verifies that the user has export entitlement for a specific resume — either via an
 * active Pro subscription or a one-time single-resume unlock recorded in
 * public.resume_unlocks. Throws PaidFeatureError if not entitled.
 */
export async function assertResumeExportEntitlement(
  supabase: SupabaseServerClient,
  appUser: AppUser,
  resumeId: string
): Promise<void> {
  if (appUser.plan === "pro") {
    return;
  }

  const { data: unlock, error } = await supabase
    .from("resume_unlocks")
    .select("id")
    .eq("user_id", appUser.id)
    .eq("resume_id", resumeId)
    .maybeSingle();

  if (error) {
    console.error("error checking resume export entitlement", error);
    throw error;
  }

  if (!unlock) {
    throw new PaidFeatureError("This resume requires Pro or a one-time unlock to download");
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
export async function refundFreeTierFeature(
  supabase: SupabaseServerClient,
  userId: string,
  feature: FreeTierLimitedFeature
): Promise<void> {
  const { error } = await supabase.rpc("decrement_free_tier_feature_usage", {
    p_user_id: userId,
    p_feature: feature,
  });
  if (error) {
    console.error("decrement_free_tier_feature_usage RPC failed", error);
  }
}

/**
 * Human-readable feature name for the free-tier limit-reached message shown to users. Kept as an
 * explicit map rather than derived from the FREE_TIER_FEATURE_LIMITS key (e.g. "co-pilot answer"
 * vs the key "copilot", "duty-suggestion" vs "role-duties-suggest") since these exact strings were
 * already shipped per-route before this map existed - changing the wording here would be a
 * user-facing copy change, not just a refactor.
 */
const FREE_TIER_FEATURE_LABELS: Record<FreeTierLimitedFeature, string> = {
  "cover-letter": "cover letter",
  "followup-draft": "follow-up draft",
  "extract-skills": "skill extraction",
  "resume-review": "resume review",
  "win-polish": "win-polish",
  "win-starters": "win starter",
  "role-duties-suggest": "duty-suggestion",
  "role-duties-bulletify": "achievement-generation",
  "project-enhance": "project-enhance",
  "skills-bridge": "skills bridge",
  copilot: "co-pilot answer",
};

/**
 * The { error, code: "FREE_LIMIT_REACHED", limit } 403 response every hard-capped free-tier route
 * was building by hand from a caught FreeTierFeatureLimitReachedError - was copy-pasted (with a
 * per-feature message swapped in) across ~9 routes.
 */
export function freeTierLimitReachedResponse(error: FreeTierFeatureLimitReachedError): NextResponse {
  return NextResponse.json(
    {
      error: `Free ${FREE_TIER_FEATURE_LABELS[error.feature]} limit reached`,
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
    async refundIfReserved(supabase: SupabaseServerClient): Promise<void> {
      if (!reservedUserId) return;
      const userId = reservedUserId;
      reservedUserId = null;
      await refundFreeTierFeature(supabase, userId, feature).catch((refundError) =>
        console.error(`failed to refund ${feature} reservation`, refundError)
      );
    },
  };
}
