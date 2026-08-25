"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const FREE_FEATURES = [
  "2 complete resumes",
  "Full experience translation engine",
  "Unlimited SEEK job-ad matching",
  "100% Australian English & conventions",
];

const PRO_FEATURES = [
  "Unlimited resumes & cover letters",
  "ATS keyword scoring",
  "PDF & editable Word downloads",
  "Cancel anytime",
];

export function PricingTeaserSection() {
  return (
    <section id="pricing" className="border-t border-border bg-paper-deep/60 py-20">
      <Container size="5xl" className="text-center">
        <Reveal>
          <span className="text-meta font-semibold uppercase tracking-wider text-accent">
            Simple Pricing
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Start free. No credit card required.
          </h2>
          <p className="mt-4 text-base text-ink-secondary sm:text-lg max-w-xl mx-auto">
            Try the full translation and matching engine free, then upgrade when you&rsquo;re ready to export.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-10 mx-auto grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="flex flex-col rounded-2xl border border-border bg-surface p-7 text-left shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Free</span>
              <p className="mt-3">
                <span className="font-display text-4xl font-bold text-ink">$0</span>{" "}
                <span className="text-sm font-medium text-ink-secondary">AUD</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">No credit card required</p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm text-ink-secondary">
                {FREE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-success font-bold">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="mt-6">
                <Button variant="outline" size="lg" className="w-full">
                  Build my resume free
                </Button>
              </Link>
            </div>

            {/* Pro */}
            <div className="flex flex-col rounded-2xl border-2 border-accent bg-surface p-7 text-left shadow-pop">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">Pro Copilot</span>
              <p className="mt-3">
                <span className="font-display text-4xl font-bold text-ink">$19</span>{" "}
                <span className="text-sm font-medium text-ink-secondary">AUD/month</span>
              </p>
              <p className="mt-1 text-xs text-ink-muted">Everything in Free, plus:</p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm text-ink-secondary">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-success font-bold">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="mt-6">
                <Button size="lg" className="w-full shadow-md">
                  Start free, upgrade anytime
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
