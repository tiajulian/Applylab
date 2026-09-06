import Stripe from "stripe";

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

export const PRICING = {
  pro: {
    priceId: requireEnv("STRIPE_PRICE_ID_PRO"),
    amountAud: 1900,
    name: "applylab Pro",
    interval: "month" as const,
  },
  resume_unlock: {
    priceId: requireEnv("STRIPE_PRICE_ID_RESUME_UNLOCK"),
    amountAud: 299,
    name: "ApplyLab Resume Unlock (One-Time)",
  },
};

