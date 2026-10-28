import type Stripe from "stripe";
import type { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// Kept out of lib/stripe/client so the resume page can import this file without loading Stripe.
/** Fallback when a completed unlock session has no amount_total. */
export const RESUME_UNLOCK_AMOUNT_AUD_CENTS = 299;

/** True when a checkout session is a paid A$2.99 unlock. A delayed method (e.g. bank debit) stays "unpaid" until it clears. */
export function isPaidResumeUnlock(session: Stripe.Checkout.Session): boolean {
  return (
    session.metadata?.plan === "resume_unlock" &&
    Boolean(session.metadata?.resumeId) &&
    Boolean(session.metadata?.userId ?? session.client_reference_id) &&
    session.payment_status !== "unpaid"
  );
}

/**
 * Grants a paid resume unlock. Called by the webhook and by the resume page when the user returns
 * from Stripe, so whichever lands first wins; the upsert makes the second a no-op.
 * Callers check isPaidResumeUnlock first.
 */
export function recordResumeUnlock(supabase: ServiceClient, session: Stripe.Checkout.Session) {
  return supabase.from("resume_unlocks").upsert(
    {
      user_id: session.metadata?.userId ?? session.client_reference_id,
      resume_id: session.metadata?.resumeId,
      stripe_session_id: session.id,
      amount_aud: session.amount_total ?? RESUME_UNLOCK_AMOUNT_AUD_CENTS,
      unlocked_at: new Date().toISOString(),
    },
    { onConflict: "user_id,resume_id" }
  );
}
