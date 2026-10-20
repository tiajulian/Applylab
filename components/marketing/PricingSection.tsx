"use client";

import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { CTA } from "@/lib/marketing/copy";
import { PLANS, PRO_BADGE, PRO_PRICES, SINGLE_UNLOCK } from "@/lib/marketing/plans";
import { STORIES } from "@/lib/stories";

// Each line must stay true. Cancel anytime: Pro cancels from the Stripe billing portal and keeps
// access to the end of the paid period (terms section 10). Data: see the FAQ and privacy policy.
const REASSURANCE = ["No credit card for Free", "Cancel Pro anytime", "Your data is never sold or used to train AI"];

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul>
      {features.map((feature) => (
        <li key={feature}>
          <span className="tick"><CheckIcon /></span>
          {feature}
        </li>
      ))}
    </ul>
  );
}

export function PricingSection() {
  return (
    <section className="section tint" id="pricing" data-section="pricing">
      <div className="container center">
        <h2 className="reveal" style={{ margin: "0 0 14px" }}>
          Start free. Upgrade when you&apos;re ready.
        </h2>
        <p className="lead reveal">
          Try ApplyLab on a real job ad for free. No credit card.
        </p>
        <div className="prices stagger">
          <div className="price">
            <div className="plan">{PLANS.free.name}</div>
            <div className="sub">{PLANS.free.audience}</div>
            <div className="amt">
              {PLANS.free.priceLabel} <small>{PLANS.free.cadence}</small>
            </div>
            <FeatureList features={PLANS.free.features} />
            <Link className="btn btn-ghost" href="/onboarding" data-cta="pricing-free">
              {CTA.startFree} &rarr;
            </Link>
          </div>

          <div className="price pop">
            <span className="badge">{PRO_BADGE}</span>
            <div className="plan">{PLANS.pro.name}</div>
            <div className="sub">{PLANS.pro.audience}</div>
            <div className="amt">
              {PRO_PRICES.month.label} <small>{PRO_PRICES.month.cadence}</small>
            </div>
            <div className="sub">or {PRO_PRICES.quarter.label} every 3 months</div>
            <FeatureList features={PLANS.pro.features} />
            <Link className="btn btn-primary" href="/pricing" data-cta="pricing-pro">
              {CTA.goPro} &rarr;
            </Link>
          </div>

          <div className="price">
            <div className="plan">{SINGLE_UNLOCK.name}</div>
            <div className="sub">{SINGLE_UNLOCK.audience}</div>
            <div className="amt">
              {SINGLE_UNLOCK.priceLabel} <small>{SINGLE_UNLOCK.cadence}</small>
            </div>
            <FeatureList features={SINGLE_UNLOCK.features} />
            <Link className="btn btn-ghost" href="/onboarding" data-cta="pricing-single">
              Get single unlock &rarr;
            </Link>
          </div>
        </div>
        <ul className="price-reassure reveal">
          {REASSURANCE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {STORIES[0] && (
          <figure className="price-story reveal">
            <blockquote>&ldquo;{STORIES[0].quote}&rdquo;</blockquote>
            <figcaption>
              {STORIES[0].firstName} &middot; {STORIES[0].role} &middot; {STORIES[0].city}
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
