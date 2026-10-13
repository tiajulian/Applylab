// Creates the October 2026 Pro prices (A$29 monthly, A$59 every 3 months) on the existing Pro
// product, and renames the product to "ApplyLab Pro". Idempotent: a price whose lookup_key
// already exists is reused, never recreated. Never edits or deletes existing prices.
//
// Usage (TEST MODE FIRST; live only after the owner signs off):
//   STRIPE_SECRET_KEY=sk_test_... STRIPE_PRICE_ID_PRO_LEGACY=price_... node scripts/stripe/create-prices-2026-10.mjs
//
// STRIPE_PRICE_ID_PRO_LEGACY (or the old STRIPE_PRICE_ID_PRO) identifies the Pro product.
// Prints only the new price IDs.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
const legacyPriceId = process.env.STRIPE_PRICE_ID_PRO_LEGACY ?? process.env.STRIPE_PRICE_ID_PRO;
if (!key || !legacyPriceId) {
  console.error("Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_PRO_LEGACY (or STRIPE_PRICE_ID_PRO).");
  process.exit(1);
}

const stripe = new Stripe(key);
const mode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "LIVE" : "test";

const PRICES = [
  {
    env: "STRIPE_PRICE_ID_PRO_MONTHLY",
    lookup_key: "pro_monthly_aud_2026_10",
    nickname: "Pro monthly A$29 (Oct 2026)",
    unit_amount: 2900,
    interval_count: 1,
  },
  {
    env: "STRIPE_PRICE_ID_PRO_QUARTERLY",
    lookup_key: "pro_quarterly_aud_2026_10",
    nickname: "Pro 3 months A$59 (Oct 2026)",
    unit_amount: 5900,
    interval_count: 3,
  },
];

const legacy = await stripe.prices.retrieve(legacyPriceId);
const productId = typeof legacy.product === "string" ? legacy.product : legacy.product.id;

await stripe.products.update(productId, { name: "ApplyLab Pro" });

const existing = await stripe.prices.list({ lookup_keys: PRICES.map((p) => p.lookup_key), limit: 10 });

console.log(`Stripe ${mode} mode`);
for (const spec of PRICES) {
  let price = existing.data.find((p) => p.lookup_key === spec.lookup_key);
  const created = !price;
  if (!price) {
    price = await stripe.prices.create({
      product: productId,
      currency: "aud",
      unit_amount: spec.unit_amount,
      recurring: { interval: "month", interval_count: spec.interval_count },
      tax_behavior: "inclusive",
      lookup_key: spec.lookup_key,
      nickname: spec.nickname,
    });
  }
  console.log(`${spec.env}=${price.id}${created ? "" : "  (already existed)"}`);
}
