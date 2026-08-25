"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { Accordion } from "@/components/marketing/Accordion";
import { TESTIMONIALS, FAQ_ITEMS } from "@/lib/marketingBridgeData";

export function ProofSection() {
  const accordionItems = FAQ_ITEMS.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));

  return (
    <section className="py-20 bg-surface border-t border-border">
      <Container size="6xl">
        {/* Testimonials */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Real Australian Success Stories
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Real career transitions, zero invented facts.
            </h2>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-paper p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">{item.name}</h3>
                    <p className="text-xs font-medium text-ink-muted">{item.location}</p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
                    {item.fromRole} &rarr; {item.toRole}
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <p className="text-ink-secondary italic">&ldquo;{item.before}&rdquo;</p>
                  <p className="font-medium text-ink">&ldquo;{item.after}&rdquo;</p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-success-soft/30 p-2.5 text-xs font-bold text-success border border-success/20 flex items-center gap-2">
                <span>✓</span>
                <span>{item.result}</span>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Frequently Asked Questions
            </span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Questions, answered honestly.
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-8 mx-auto max-w-3xl">
            <Accordion items={accordionItems} />
          </div>
        </Reveal>

        {/* Final CTA */}
        <div className="mx-auto mt-20 max-w-2xl flex flex-col items-center text-center border-t border-border pt-16">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink">
              Your next job might be closer than you think.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              You may already have more relevant experience than your resume shows. Let ApplyLab translate what you&rsquo;ve actually done into the language of the job you want.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link href="/signup">
                <Button size="lg" className="shadow-md px-8 py-3.5 text-base">
                  Build my resume free
                </Button>
              </Link>
              <p className="text-xs text-ink-muted">
                2 resumes free &middot; No credit card required &middot; Takes less than 2 minutes
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
