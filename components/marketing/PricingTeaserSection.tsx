"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const FREE_FEATURES = [
  "2 complete tailored application packages",
  "Single verified career profile",
  "Unlimited SEEK & Australian job matching",
  "Chrome extension 1-click form autofill",
  "100% Australian English & ATS formatting",
];

const PRO_FEATURES = [
  "Unlimited resumes & role-specific cover letters",
  "Full AI Interview Coach simulations & STAR reports",
  "Advanced ATS match & keyword scoring",
  "Direct PDF & editable Word downloads",
  "Kanban Application Tracker sync & priority support",
];

export function PricingTeaserSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "quarterly">("monthly");

  return (
    <section id="pricing" className="scroll-mt-24 bg-paper-deep/40 py-20 border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Header, Period Toggle, Resume Writer Callout */}
          <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch]">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Simple, Transparent Pricing
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Start free. No credit card required.
              </h2>
              <p className="mt-4 text-base text-ink-secondary sm:text-lg leading-relaxed">
                Test the full job matching, resume tailoring, and extension engine free, then upgrade for unlimited copilot power.
              </p>

              {/* Monthly vs 3-Month Segmented Toggle with animated layoutId */}
              <div className="relative mt-6 flex w-full sm:w-auto items-center rounded-lg border border-border bg-paper p-1">
                <button
                  type="button"
                  onClick={() => setBillingPeriod("monthly")}
                  className={`relative z-10 flex-1 sm:flex-initial rounded-md px-3.5 py-1.5 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    billingPeriod === "monthly" ? "text-ink" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  Monthly
                  {billingPeriod === "monthly" && (
                    <motion.span
                      layoutId="pricingPeriodToggle"
                      className="absolute inset-0 -z-10 rounded-md bg-surface shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod("quarterly")}
                  className={`relative z-10 flex-1 sm:flex-initial rounded-md px-3.5 py-1.5 text-xs font-semibold text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    billingPeriod === "quarterly" ? "text-ink" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  3 Months (Save 32%)
                  {billingPeriod === "quarterly" && (
                    <motion.span
                      layoutId="pricingPeriodToggle"
                      className="absolute inset-0 -z-10 rounded-md bg-surface shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              </div>

              <p className="mt-5 text-xs font-semibold text-ink-muted">
                A human resume writer costs $350&ndash;600 AUD and takes days.
              </p>

              <div className="mt-6">
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline transition-transform active:scale-95"
                >
                  View full pricing &amp; feature comparison &rarr;
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Free and Pro Plan Cards */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Free Card */}
            <Reveal delay={0.1}>
              <div className="h-full flex flex-col rounded-2xl border border-border bg-surface p-6 sm:p-7 text-left shadow-sm transition-all duration-300 hover:shadow-pop hover:-translate-y-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Free Tier</span>
                <p className="mt-3">
                  <span className="font-display text-4xl font-bold text-ink">$0</span>{" "}
                  <span className="text-sm font-medium text-ink-secondary">AUD</span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">No credit card required</p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-xs sm:text-sm text-ink-secondary">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success font-bold">&#10003;</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/onboarding" className="mt-6">
                  <Button variant="outline" size="md" className="w-full font-semibold transition-transform active:scale-95">
                    Start for free &rarr;
                  </Button>
                </Link>
              </div>
            </Reveal>

            {/* Pro Card */}
            <Reveal delay={0.16}>
              <div className="relative h-full flex flex-col rounded-2xl border-2 border-accent bg-surface p-6 sm:p-7 text-left shadow-pop transition-all duration-300 hover:shadow-pop-lg hover:-translate-y-0.5">
                <div className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                  Most popular
                </div>

                <span className="text-xs font-bold uppercase tracking-wider text-accent">Pro Copilot</span>
                <div className="mt-3">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={billingPeriod}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className="font-display text-4xl font-bold text-ink">
                        {billingPeriod === "monthly" ? "$19" : "$39"}
                      </span>{" "}
                      <span className="text-sm font-medium text-ink-secondary">
                        {billingPeriod === "monthly" ? "AUD/month" : "AUD/3 months"}
                      </span>
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {billingPeriod === "monthly" ? "Cancel anytime" : "Equivalent to $13/month"}
                </p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-xs sm:text-sm text-ink-secondary">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success font-bold">&#10003;</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/onboarding" className="mt-6">
                  <Button size="md" className="w-full font-bold shadow-sm transition-transform active:scale-95">
                    Start free, upgrade anytime &rarr;
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

