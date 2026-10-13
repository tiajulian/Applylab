import { FREE_RESUME_LIMIT, FREE_TIER_FEATURE_LIMITS, FREE_ASSIST_LIMIT_PER_RESUME } from "@/lib/limits";
import { FEATURE_LABELS } from "@/lib/marketing/copy";

/**
 * Plan names, prices and feature lists for every screen that shows a price: home pricing section,
 * /pricing, /upgrade, the upsell modal and the limit-reached prompts. Client-safe (no secrets);
 * Stripe price IDs live server-side in lib/stripe/client.ts. scripts/stripe/verify-prices.mjs
 * checks the amounts below against Stripe, so a change here must be matched by a new Stripe price.
 */

export type ProInterval = "month" | "quarter";

/** "A$29" for whole dollars, "A$19.67" otherwise. Always prefixed: ApplyLab has overseas visitors. */
export function formatAud(cents: number): string {
  return `A$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;
}

/** Per-month equivalent of a multi-month price, rounded to the cent. */
export function perMonthCents(totalCents: number, months: number): number {
  return Math.round(totalCents / months);
}

/** Saving vs paying monthly for the same months, rounded down so we never overstate it. */
export function savingPercent(monthlyCents: number, totalCents: number, months: number): number {
  return Math.floor((1 - totalCents / (monthlyCents * months)) * 100);
}

const MONTHLY_CENTS = 2900;
const QUARTER_CENTS = 5900;
const QUARTER_MONTHS = 3;

export const PRO_PRICES = {
  month: {
    amountCents: MONTHLY_CENTS,
    intervalCount: 1,
    label: formatAud(MONTHLY_CENTS),
    cadence: "/ month",
    /** Button text, e.g. "A$29 / month". */
    buttonLabel: `${formatAud(MONTHLY_CENTS)} / month`,
  },
  quarter: {
    amountCents: QUARTER_CENTS,
    intervalCount: QUARTER_MONTHS,
    label: formatAud(QUARTER_CENTS),
    cadence: "/ 3 months",
    buttonLabel: `${formatAud(QUARTER_CENTS)} / 3 months`,
    perMonthLabel: `${formatAud(perMonthCents(QUARTER_CENTS, QUARTER_MONTHS))}/month`,
    savingLabel: `Save ${savingPercent(MONTHLY_CENTS, QUARTER_CENTS, QUARTER_MONTHS)}%`,
  },
} as const;

/** ApplyLab is registered for GST (owner confirmed, Oct 2026), so prices are shown GST-inclusive. */
export const PRICES_INCLUDE_GST_CONFIRMED = true;

export const PRO_FINE_PRINT = PRICES_INCLUDE_GST_CONFIRMED
  ? "Cancel anytime. Prices include GST."
  : "Cancel anytime.";

export const FREE_RESUMES_LABEL = `${FREE_RESUME_LIMIT} tailored resume${FREE_RESUME_LIMIT === 1 ? "" : "s"}`;

export const PRO_BADGE = "Best for active job seekers";

export const PLANS = {
  free: {
    name: "Free",
    priceLabel: formatAud(0),
    cadence: "forever",
    audience: "Try it on your next application.",
    features: [
      `${FREE_RESUMES_LABEL}, ready to download`,
      "Free resume score",
      `${FREE_TIER_FEATURE_LIMITS["cover-letter"]} cover letter`,
      "Limited AI suggestions",
      "All 8 resume templates",
      "Application tracker",
      "Chrome extension to fill in job applications",
    ],
  },
  pro: {
    name: "Pro",
    audience: "For when you're applying to several jobs.",
    prices: PRO_PRICES,
    features: [
      "Unlimited tailored resumes and cover letters",
      "Interview practice with feedback",
      "PDF and Word downloads",
      "Only uses your real experience",
      "Priority email support",
    ],
  },
} as const;

/**
 * Every free AI allowance, for the pricing FAQ ("What are the free limits?"). Read from the same
 * constants the server enforces, so the FAQ can't drift from the code.
 */
export const FREE_LIMIT_LINES: readonly string[] = [
  `${FREE_RESUMES_LABEL}`,
  `${FREE_ASSIST_LIMIT_PER_RESUME} "Improve with AI" edits per resume`,
  ...(Object.keys(FREE_TIER_FEATURE_LIMITS) as (keyof typeof FREE_TIER_FEATURE_LIMITS)[]).map((feature) => `${FEATURE_LABELS[feature].plural}: ${FREE_TIER_FEATURE_LIMITS[feature]}`),
];

/** One-off purchase (PRICE_IDS.resumeUnlock in lib/stripe/client.ts), not a plan. */
export const SINGLE_UNLOCK = {
  name: "Single resume",
  priceLabel: formatAud(299),
  cadence: "once",
  audience: "Download one tailored resume, no subscription.",
  features: ["One tailored resume", "PDF and Word downloads", "Yours to keep"],
} as const;
