/**
 * Free-tier limits, kept dependency-free so client components (pricing, marketing) can import
 * them without pulling in lib/requireUser.ts's server-only Supabase code. lib/requireUser.ts
 * re-exports these, so existing imports keep working.
 */

export const FREE_RESUME_LIMIT = 1;
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
