// Kept apart from scoreClaim.ts (which uses node:crypto) so client components can import the
// claim path.
import { cookieOptions } from "@/lib/supabase/cookieOptions";

/**
 * A visitor without an account who scores a resume on /resume-score gets the result held server
 * side (public.pending_resume_scores) and a random claim token in this httpOnly cookie. The
 * scorer's own signup and log-in then send them to SCORE_CLAIM_PATH, which turns it into a resume
 * in their account. Only those flows claim: the cookie belongs to the browser, which may be shared.
 */
export const SCORE_CLAIM_COOKIE = "score_claim";
export const SCORE_CLAIM_PATH = "/resume-score/claim";
/** Log in, then claim (the login page gives this destination a full page load). */
export const SCORE_CLAIM_LOGIN_URL = `/login?redirectedFrom=${encodeURIComponent(SCORE_CLAIM_PATH)}`;
/** Sign up, then claim (the login page's "Sign up" link, when it was opened to claim a score). */
export const SCORE_CLAIM_SIGNUP_URL = `/signup?redirectedFrom=${encodeURIComponent(SCORE_CLAIM_PATH)}`;
/** Where signup/OAuth/confirmation links come back to, then on to the claim. */
export const SCORE_CLAIM_CALLBACK_PATH = `/auth/callback?next=${encodeURIComponent(SCORE_CLAIM_PATH)}`;
/**
 * Matches pending_resume_scores.expires_at's default. Short on purpose: long enough to confirm an
 * email, short enough that a resume's personal details don't sit in a (possibly shared) browser.
 */
export const SCORE_CLAIM_MAX_AGE_SECONDS = 2 * 24 * 60 * 60;

export const scoreClaimCookieOptions = {
  ...cookieOptions,
  httpOnly: true,
  path: "/",
  maxAge: SCORE_CLAIM_MAX_AGE_SECONDS,
};
