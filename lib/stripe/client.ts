import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-06-24.dahlia",
});

export const PRICING = {
  pro: { amountAud: 1900, name: "applylab Pro", interval: "month" as const },
  lifetime: { amountAud: 7900, name: "applylab Lifetime" },
  resume_unlock: { amountAud: 299, name: "ApplyLab Resume Unlock (One-Time)" },
};

