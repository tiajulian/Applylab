import { FREE_RESUME_LIMIT } from "@/lib/limits";

/**
 * Plan names, prices and feature lists for the home pricing section, /pricing and /upgrade.
 * Numeric limits come from lib/limits.ts, never retyped here.
 *
 * Deliberately omitted until the owner resolves them (see the messaging overhaul report):
 * - a free cover letter count (FREE_TIER_FEATURE_LIMITS["cover-letter"] = 2 disagrees with
 *   COVER_LETTER_LIMITS.freeLetters = 1)
 * - a 3-month Pro price: there is no quarterly Stripe price, checkout only sells monthly Pro
 */

export const FREE_RESUMES_LABEL = `${FREE_RESUME_LIMIT} tailored resume${FREE_RESUME_LIMIT === 1 ? "" : "s"}`;

export const PRO_BADGE = "Best for active job seekers";

export const PLANS = {
  free: {
    name: "Free",
    priceLabel: "$0",
    cadence: "forever",
    audience: "Try it on your next application.",
    features: [
      FREE_RESUMES_LABEL,
      "Free resume score",
      "Try the cover letter writer",
      "All 8 resume templates",
      "Application tracker",
      "Chrome extension to fill in job applications",
    ],
  },
  pro: {
    name: "Pro",
    audience: "For when you're applying to several jobs.",
    prices: {
      monthly: { amount: 19, label: "$19 AUD / month" },
    },
    features: [
      "Unlimited tailored resumes and cover letters",
      "Interview practice with feedback",
      "PDF and Word downloads",
      "Only uses your real experience",
      "Priority email support",
    ],
  },
} as const;

/** One-off purchase (PRICING.resume_unlock in lib/stripe/client.ts), not a plan. */
export const SINGLE_UNLOCK = {
  name: "Single resume",
  priceLabel: "$2.99",
  cadence: "AUD once",
  audience: "Download one tailored resume, no subscription.",
  features: ["One tailored resume", "PDF and Word downloads", "Yours to keep"],
} as const;
