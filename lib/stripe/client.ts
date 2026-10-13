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

export const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
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
  // A$19 monthly, grandfathered: only used to recognise existing subscriptions, never sold.
  // Falls back to the old variable name until STRIPE_PRICE_ID_PRO_LEGACY is set everywhere.
  proLegacy: process.env.STRIPE_PRICE_ID_PRO_LEGACY ?? process.env.STRIPE_PRICE_ID_PRO ?? null,
  resumeUnlock: requireEnv("STRIPE_PRICE_ID_RESUME_UNLOCK"),
} as const;

/** Every price that makes a subscription Pro, including the grandfathered one. */
export const PRO_PRICE_IDS: ReadonlySet<string> = new Set(
  [PRICE_IDS.pro.month, PRICE_IDS.pro.quarter, PRICE_IDS.proLegacy].filter((id): id is string => Boolean(id))
);

/** Billing portal URL for an existing customer; shared by the portal route and checkout's "already Pro" path. */
export async function createBillingPortalUrl(customerId: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL!}/profile`,
  });
  return session.url;
}

/** Fallback for the webhook when a completed unlock session has no amount_total. */
export const RESUME_UNLOCK_AMOUNT_AUD_CENTS = 299;
