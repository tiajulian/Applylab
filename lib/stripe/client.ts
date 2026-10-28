import Stripe from "stripe";
import type { ProInterval } from "@/lib/marketing/plans";

export type { ProInterval };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const secretKey = requireEnv("STRIPE_SECRET_KEY");
// Only the production deployment may charge real cards: a preview or local run with live keys fails loudly.
// Falls back to NODE_ENV where VERCEL_ENV isn't set, so production can never be locked out by it.
const deployEnv = process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "production" ? "production" : "development");
if (secretKey.startsWith("sk_live_") && deployEnv !== "production") {
  throw new Error("Live Stripe key outside production. Use test-mode keys for preview and local development.");
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2026-06-24.dahlia",
});

/**
 * Server-only map of Stripe price IDs. Amounts are not stored here: displayed prices come from
 * PRO_PRICES in lib/marketing/plans.ts, checked against Stripe by scripts/stripe/verify-prices.mjs.
 */
export const PRICE_IDS = {
  pro: {
    month: requireEnv("STRIPE_PRICE_ID_PRO_MONTHLY"),
    quarter: requireEnv("STRIPE_PRICE_ID_PRO_QUARTERLY"),
  } satisfies Record<ProInterval, string>,
  resumeUnlock: requireEnv("STRIPE_PRICE_ID_RESUME_UNLOCK"),
} as const;

/** Every price that makes a subscription Pro. */
export const PRO_PRICE_IDS: ReadonlySet<string> = new Set(Object.values(PRICE_IDS.pro));

/** Billing portal URL for an existing customer; shared by the portal route and checkout's "already Pro" path. */
export async function createBillingPortalUrl(customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL!}/profile`,
  });
  return session.url;
}

export interface ProSubscriptionSummary {
  /** When the current period ends: the renewal date, or the last day of Pro if it's cancelling. */
  periodEnd: Date | null;
  cancelsAtPeriodEnd: boolean;
}

/** The customer's live Pro subscription, for "Current plan: Pro, renews on ..." (null if none). */
export async function getProSubscriptionSummary(customerId: string): Promise<ProSubscriptionSummary | null> {
  const { data } = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const live = data.find(
    (sub) =>
      ["active", "trialing", "past_due"].includes(sub.status) &&
      sub.items.data.some((item) => PRO_PRICE_IDS.has(item.price.id))
  );
  if (!live) return null;
  // Since the 2025 "basil" API, the billing period lives on each subscription item.
  const ends = live.items.data.map((item) => item.current_period_end).filter((t): t is number => typeof t === "number");
  return {
    periodEnd: ends.length ? new Date(Math.min(...ends) * 1000) : null,
    cancelsAtPeriodEnd: live.cancel_at_period_end,
  };
}
