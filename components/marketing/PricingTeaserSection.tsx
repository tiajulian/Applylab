"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { PROOF_FIGURES } from "@/lib/marketingProofData";

const FREE_FEATURES = [
  "2 complete tailored application packages",
  "Single verified career profile",
  "Unlimited SEEK & Australian job matching",
  "Chrome extension 1-click form autofill",
  "100% Australian English & ATS formatting",
  "Standard PDF resume export",
];

const PRO_FEATURES = [
  "Unlimited resumes & role-specific cover letters",
  "Full AI Voice STAR Interview Coach simulations",
  "Turn-by-turn STAR scorecard feedback reports",
  "Direct PDF & editable Word .docx downloads",
  "Kanban Application Tracker sync & priority support",
  "All 8 ATS-safe templates",
];

export function PricingTeaserSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "quarterly">("monthly");

  return (
    <section id="pricing" className="scroll-mt-24 sec band">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Simple, Transparent Pricing
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Start free. Upgrade when you need unlimited power.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Test the full matching, resume tailoring, and extension engine completely free. No credit card required.
            </p>

            {/* Monthly vs 3-Month Toggle */}
            <div className="relative mt-8 inline-flex items-center rounded-lg border border-border bg-paper p-1">
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`relative z-10 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
                className={`relative z-10 rounded-md px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
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
          </Reveal>
        </div>

        {/* Pricing Cards Grid (Free, Pro, and One-Time Unlock Callout) */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: Free Tier */}
          <Reveal delay={0.1}>
            <div className="market-card p-6 sm:p-8 flex flex-col justify-between h-full bg-surface">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Free Tier
                  </span>
                  <span className="rounded-full bg-paper-deep px-2.5 py-0.5 text-[10px] font-semibold text-ink-secondary">
                    No card required
                  </span>
                </div>
                <p className="mt-3">
                  <span className="font-display text-4xl font-bold text-ink">$0</span>
                  <span className="text-xs text-ink-muted font-medium ml-1.5">AUD forever</span>
                </p>
                <p className="mt-1.5 text-xs text-ink-secondary">
                  Two complete tailored applications to experience the difference.
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-border pt-6 text-xs text-ink">
                  {FREE_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckIcon className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link href="/onboarding" className="block w-full">
                  <Button variant="outline" size="md" className="w-full font-bold text-xs py-2.5">
                    Start free &rarr;
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Card 2: Pro Tier */}
          <Reveal delay={0.16}>
            <div className="market-card p-6 sm:p-8 flex flex-col justify-between h-full bg-surface border-2 border-accent shadow-pop relative">
              <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold text-on-accent uppercase tracking-wider shadow-sm">
                Most Popular
              </span>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">
                    Pro Copilot
                  </span>
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold text-accent">
                    Complete Toolkit
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={billingPeriod}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-baseline gap-1"
                    >
                      <span className="font-display text-4xl font-bold text-ink">
                        {billingPeriod === "monthly" ? PROOF_FIGURES.proMonthlyPrice : "$13"}
                      </span>
                      <span className="text-xs text-ink-muted font-medium">
                        AUD / month {billingPeriod === "quarterly" && "(billed $39 quarterly)"}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <p className="mt-1.5 text-xs text-ink-secondary">
                  Unlimited tailored resumes, cover letters, extension autofill, and voice interview coaching.
                </p>

                <ul className="mt-6 space-y-2.5 border-t border-border pt-6 text-xs text-ink">
                  {PRO_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckIcon className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8">
                <Link href="/onboarding" className="block w-full">
                  <Button size="md" className="w-full font-bold text-xs py-2.5 shadow-sm">
                    Start free, upgrade anytime &rarr;
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>

        {/* The $2.99 Single Resume Unlock Callout */}
        <Reveal delay={0.22}>
          <div className="mt-8 max-w-4xl mx-auto rounded-lg border border-border bg-surface p-4 sm:p-5 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="font-bold text-xs text-ink">Need just one application?</span>
                <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                  {PROOF_FIGURES.oneTimeUnlockPrice} one-off
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-secondary">
                {PROOF_FIGURES.oneTimeUnlockPrice} unlocks a single tailored resume, PDF and Word .docx, yours to keep forever without a subscription.
              </p>
            </div>
            <Link href="/onboarding" className="shrink-0 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs font-semibold">
                Get single unlock &rarr;
              </Button>
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
