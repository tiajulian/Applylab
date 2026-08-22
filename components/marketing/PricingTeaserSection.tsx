"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

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
            Experience the complete translation workflow with 2 free resumes before deciding to upgrade.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-10 mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 shadow-pop text-center">
            <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
              Free Tier Included
            </span>
            <p className="mt-4">
              <span className="font-display text-5xl font-bold text-ink">$0</span>{" "}
              <span className="text-sm font-medium text-ink-secondary">AUD</span>
            </p>
            <p className="mt-2 text-xs font-semibold text-success">
              2 Complete Resumes Free &middot; Zero Risk
            </p>

            <ul className="mt-6 space-y-2 text-xs text-ink-secondary text-left border-t border-b border-border py-4">
              <li className="flex items-center gap-2 font-medium">
                <span className="text-success font-bold">✓</span> Full Experience Translation Engine
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="text-success font-bold">✓</span> Unlimited SEEK Job Ad Matching
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="text-success font-bold">✓</span> Strict 1-Page PDF &amp; Editable Word Export
              </li>
              <li className="flex items-center gap-2 font-medium">
                <span className="text-success font-bold">✓</span> 100% Australian English &amp; Conventions
              </li>
            </ul>

            <div className="mt-6">
              <Link href="/signup">
                <Button size="lg" className="w-full shadow-md">
                  Build my resume free
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-ink-muted">
              Need unlimited resumes? Pro plans start at $19 AUD/month.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
