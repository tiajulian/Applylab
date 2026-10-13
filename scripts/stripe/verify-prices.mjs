// Checks the Pro prices in Stripe match what the site shows (PRO_PRICES in lib/marketing/plans.ts)
// and that the env var price IDs point at them. Exits non-zero on any mismatch. Prints no secrets.
//
// Usage:
//   STRIPE_SECRET_KEY=... STRIPE_PRICE_ID_PRO_MONTHLY=... STRIPE_PRICE_ID_PRO_QUARTERLY=... \
//     node scripts/stripe/verify-prices.mjs
//
// The expected amounts are parsed from lib/marketing/plans.ts (MONTHLY_CENTS / QUARTER_CENTS /
// QUARTER_MONTHS) so this script can't drift from the displayed prices.

import { readFileSync } from "node:fs";
import Stripe from "stripe";

const plans = readFileSync(new URL("../../lib/marketing/plans.ts", import.meta.url), "utf8");
function constant(name) {
  const match = plans.match(new RegExp(`const ${name} = (\\d+);`));
  if (!match) throw new Error(`Could not find ${name} in lib/marketing/plans.ts`);
  return Number(match[1]);
}

const EXPECTED = [
  {
    env: "STRIPE_PRICE_ID_PRO_MONTHLY",
    lookup_key: "pro_monthly_aud_2026_10",
    unit_amount: constant("MONTHLY_CENTS"),
    interval_count: 1,
  },
  {
    env: "STRIPE_PRICE_ID_PRO_QUARTERLY",
    lookup_key: "pro_quarterly_aud_2026_10",
    unit_amount: constant("QUARTER_CENTS"),
    interval_count: constant("QUARTER_MONTHS"),
  },
];

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY.");
  process.exit(1);
}

const stripe = new Stripe(key);
const { data } = await stripe.prices.list({ lookup_keys: EXPECTED.map((e) => e.lookup_key), limit: 10 });

const failures = [];
for (const want of EXPECTED) {
  const price = data.find((p) => p.lookup_key === want.lookup_key);
  if (!price) {
    failures.push(`${want.lookup_key}: not found`);
    continue;
  }
  const checks = [
    ["unit_amount", price.unit_amount, want.unit_amount],
    ["currency", price.currency, "aud"],
    ["recurring.interval", price.recurring?.interval, "month"],
    ["recurring.interval_count", price.recurring?.interval_count, want.interval_count],
    ["tax_behavior", price.tax_behavior, "inclusive"],
    ["active", price.active, true],
    [want.env, process.env[want.env], price.id],
  ];
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) failures.push(`${want.lookup_key} ${field}: expected ${expected}, got ${actual}`);
  }
  console.log(`${want.lookup_key}: ${price.id}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} mismatch(es):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("All Pro prices match.");
