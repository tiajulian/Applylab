/**
 * Free-tier limits, kept dependency-free so client components (pricing, marketing) can import
 * them without pulling in lib/requireUser.ts's server-only Supabase code. lib/requireUser.ts
 * re-exports these, so existing imports keep working.
 */

export const FREE_RESUME_LIMIT = 1;
export const FREE_ASSIST_LIMIT_PER_RESUME = 5;
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
  // Owner to decide 1 or 2: COVER_LETTER_LIMITS.freeLetters is 1 (pricing brief 9.3).
  "cover-letter": 2,
  "followup-draft": 2,
  "extract-skills": 10,
  "resume-review": 2,
  "win-polish": 5,
  "win-starters": 5,
  "role-duties-suggest": 5,
  "role-duties-bulletify": 5,
  "project-enhance": 3,
  "skills-bridge": 2,
  copilot: 10,
} as const;

export type FreeTierLimitedFeature = keyof typeof FREE_TIER_FEATURE_LIMITS;
