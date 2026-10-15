"use client";

import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { CTA } from "@/lib/marketing/copy";
import { PLANS, PRO_BADGE, PRO_PRICES, SINGLE_UNLOCK } from "@/lib/marketing/plans";

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
    <section className="section tint" id="pricing">
      <div className="container center">
        <h2 className="reveal" style={{ margin: "0 0 14px" }}>
          Start free. Upgrade when you&apos;re applying a lot.
        </h2>
        <p className="lead reveal">
          Try ApplyLab on a real job ad for free. No credit card needed.
        </p>
        <div className="prices stagger">
          <div className="price">
            <div className="plan">{PLANS.free.name}</div>
            <div className="sub">{PLANS.free.audience}</div>
            <div className="amt">
              {PLANS.free.priceLabel} <small>{PLANS.free.cadence}</small>
            </div>
            <FeatureList features={PLANS.free.features} />
            <Link className="btn btn-ghost" href="/onboarding">
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
            <Link className="btn btn-primary" href="/pricing">
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
            <Link className="btn btn-ghost" href="/onboarding">
              Get single unlock &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
