"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Accordion, AccordionItemData } from "@/components/marketing/Accordion";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { MARKETING_NAV_LINKS } from "@/lib/marketing/nav";
import { useMarketingUser } from "@/lib/marketing/useMarketingUser";
import { BRAND, CTA, HOW_IT_WORKS } from "@/lib/marketing/copy";
import { FREE_LIMIT_LINES, PLANS, PRICES_INCLUDE_GST_CONFIRMED, PRO_BADGE, PRO_FINE_PRINT, PRO_PRICES, type ProInterval } from "@/lib/marketing/plans";
import { useProCheckout } from "@/lib/hooks/useProCheckout";
import { BillingIntervalToggle, ProPriceDisplay } from "@/components/upgrade/BillingIntervalToggle";
import { CheckIcon, ArrowRightIcon } from "@/components/ui/icons/LucideIcons";

const FAQ_ITEMS: AccordionItemData[] = [
  {
    question: "Why pay for ApplyLab instead of using free ChatGPT?",
    answer:
      "ApplyLab writes every resume from your profile, a one-time record of your experience, so nothing is made up. It reads the job ad for you and formats an Australian resume (one page for most careers) you can download as PDF or Word.",
  },
  {
    question: "What happens after my free resume?",
    answer: `Your profile and your free resume stay in your account, ready to download. Go Pro when you want more tailored resumes, cover letters or interview practice: ${PRO_PRICES.month.buttonLabel}, or ${PRO_PRICES.quarter.label} every 3 months.`,
  },
  {
    question: "What are the free limits?",
    answer: `Free is a one-time allowance that never resets: ${FREE_LIMIT_LINES.join("; ")}. Pro has no per-feature limits.`,
  },
  // Shown only once the owner confirms GST registration (pricing brief 8.1).
  ...(PRICES_INCLUDE_GST_CONFIRMED
    ? [
        {
          question: "Is GST included in the price?",
          answer: "Yes. All prices are in Australian dollars (AUD) and include 10% GST.",
        },
      ]
    : []),
];

function PlanFeatures({ features }: { features: readonly string[] }) {
  return (
    <ul className="mt-4 space-y-3 text-body text-ink">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2.5 sm:gap-3">
          <CheckIcon className="h-4 w-4 shrink-0 text-success" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingView() {
  const router = useRouter();
  // Fetched client-side, not passed as a prop - see lib/marketing/useMarketingUser.ts. Only used
  // below as an early redirect before hitting /api/stripe/checkout; that route enforces real auth
  // itself and this component already handles its 401 the same way, so a user click landing
  // before this resolves just means one extra hop through /login, not a security gap.
  const { user } = useMarketingUser();
  const [billingInterval, setBillingInterval] = useState<ProInterval>("month");
  const { startCheckout, pendingInterval, error: checkoutError } = useProCheckout("/pricing");

  function handleStartPro() {
    if (!user) {
      router.push("/login?redirectedFrom=/pricing");
      return;
    }
    void startCheckout(billingInterval);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink selection:bg-accent-soft selection:text-accent overflow-x-hidden">
      <MarketingHeader
        navLinks={MARKETING_NAV_LINKS}
        activeHref="/pricing"
        maxWidthClassName="max-w-6xl"
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Section A: Hero Header */}
        <section className="mx-auto max-w-4xl px-4 pt-8 pb-6 text-center md:pt-16 md:pb-12">
          <h1 className="font-display text-[28px] sm:text-[40px] md:text-display text-ink leading-tight sm:leading-[1.1]">
            Simple pricing. Start free.
          </h1>

          <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-body sm:text-body-lg text-ink-secondary">
            {BRAND.oneLiner}
          </p>

          <p className="mt-2.5 text-xs sm:text-meta font-medium text-ink-muted">
            All prices in AUD.{PRICES_INCLUDE_GST_CONFIRMED && " Includes GST."}
          </p>

          {/* Section B: How it works, as step pills */}
          <ol className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent"
              >
                {i + 1}. {step.title}
              </li>
            ))}
          </ol>
        </section>

        {/* Section C: Plan Cards (Side-by-Side Grid) */}
        <section className="mx-auto max-w-6xl px-4 py-4 sm:py-6 md:py-10">
          <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
            {/* Card 1: Free */}
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm transition-all duration-fast hover:border-border-strong">
              <div>
                <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">{PLANS.free.name}</h2>

                <div className="mt-4 flex flex-wrap items-baseline gap-1">
                  <span className="font-display text-[36px] sm:text-[42px] font-bold text-ink">{PLANS.free.priceLabel}</span>
                  <span className="ml-1 text-xs sm:text-meta text-ink-muted">{PLANS.free.cadence}, no card needed</span>
                </div>

                <p className="mt-3 text-body text-ink-secondary">{PLANS.free.audience}</p>

                <div className="mt-6 border-t border-border pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">What&apos;s included</h3>
                  <PlanFeatures features={PLANS.free.features} />
                </div>
              </div>

              <div className="mt-8 pt-2">
                <Link href="/onboarding" className="block w-full">
                  <Button variant="outline" className="w-full justify-center py-3 font-bold text-ink">
                    {CTA.startFree}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Card 2: Pro (Highlighted) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-accent bg-surface p-6 sm:p-8 shadow-pop transition-all duration-fast hover:shadow-lg mt-4 sm:mt-0">
              {/* Highlight Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent-hover px-3.5 py-1 text-xs font-extrabold tracking-wide text-on-accent shadow-md whitespace-nowrap max-w-[90%] text-center">
                {PRO_BADGE}
              </div>

              <div>
                <h2 className="pt-2 font-display text-h3 tracking-[-0.01em] text-ink">{PLANS.pro.name}</h2>

                <BillingIntervalToggle value={billingInterval} onChange={setBillingInterval} className="mt-4" />

                <div className="mt-4">
                  <ProPriceDisplay interval={billingInterval} />
                </div>

                <p className="mt-3 text-body text-ink-secondary">{PLANS.pro.audience}</p>

                <div className="mt-6 border-t border-border pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent">Everything in Free, plus:</h3>
                  <PlanFeatures features={PLANS.pro.features} />
                </div>
              </div>

              <div className="mt-8 pt-2">
                <Button
                  type="button"
                  onClick={handleStartPro}
                  isLoading={pendingInterval !== null}
                  className="w-full justify-center py-3.5 text-body font-bold shadow-md"
                >
                  {CTA.goPro} <ArrowRightIcon className="ml-1 inline h-4 w-4 align-text-bottom" />
                </Button>
                {checkoutError && (
                  <p className="mt-2 text-center text-xs font-semibold text-critical">{checkoutError}</p>
                )}
                <p className="mt-3 text-center text-meta text-ink-muted">
                  {PRO_FINE_PRINT}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section D: Frequently Asked Questions (FAQ Accordion) */}
        <section className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
          <div className="text-center">
            <h2 className="font-display text-h2 text-ink">Frequently Asked Questions</h2>
            <p className="mt-2 text-body text-ink-secondary">Everything you need to know about plans and billing.</p>
          </div>

          <div className="mt-6 sm:mt-8">
            <Accordion items={FAQ_ITEMS} />
          </div>
        </section>

        {/* Section E: Final Call to Action */}
        <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12 mb-8 sm:mb-12">
          {/* bg-accent-hover, not bg-accent: white text on the base accent only hits 3.6:1 (needs 4.5:1) */}
          <div className="rounded-3xl bg-accent-hover p-6 sm:p-10 md:p-14 text-center text-on-accent shadow-pop">
            <h2 className="font-display text-[26px] sm:text-display sm:text-[40px] leading-tight">
              Ready for your next application?
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-body sm:text-body-lg">
              {BRAND.oneLiner}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
              <Button
                type="button"
                onClick={handleStartPro}
                className="bg-surface text-ink hover:bg-paper font-bold px-6 sm:px-8 py-3.5 text-body rounded-pill shadow-md w-full sm:w-auto"
              >
                {CTA.goPro} ({PRO_PRICES[billingInterval].buttonLabel.replace(" / ", "/")})
              </Button>
              <Link href="/onboarding" className="w-full sm:w-auto">
                <Button variant="outline" className="border-on-accent/40 text-on-accent hover:bg-on-accent/10 font-bold px-6 sm:px-8 py-3.5 text-body rounded-pill w-full">
                  {CTA.startFree}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
