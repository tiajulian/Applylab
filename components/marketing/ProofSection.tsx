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
    <section className="bg-paper py-20 border-b border-border/60">
      <Container size="marketing">
        {/* Testimonials Block */}
        <div>
          {/* Left-Aligned Testimonials Header */}
          <div className="flex flex-col items-start max-w-[58ch]">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Real Australian Success Stories
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Real career transitions, zero invented facts.
              </h2>
            </Reveal>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS.slice(0, 2).map((item, idx) => (
              <Reveal key={item.id} delay={idx * 0.1}>
                <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-pop-lg hover:-translate-y-0.5">
                  <div>
                    <div className="flex items-start justify-between border-b border-border pb-3.5 gap-2">
                      <div>
                        <h3 className="font-display text-base font-bold text-ink">{item.name}</h3>
                        <p className="text-xs font-medium text-ink-muted">{item.location}</p>
                      </div>
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent shrink-0">
                        {item.fromRole} &rarr; {item.toRole}
                      </span>
                    </div>

                    <div className="mt-3.5 space-y-2 text-xs sm:text-sm">
                      <p className="text-ink-secondary italic">&ldquo;{item.before}&rdquo;</p>
                      <p className="font-medium text-ink">&ldquo;{item.after}&rdquo;</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg bg-success-soft/40 p-2.5 text-xs font-bold text-success border border-success/20 flex items-center gap-2">
                    <span>&#10003;</span>
                    <span>{item.result}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* 2-Column FAQ Section */}
        <div id="faq" className="scroll-mt-24 mt-24 pt-16 border-t border-border">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column: FAQ Header */}
            <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch]">
              <Reveal>
                <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                  Frequently Asked Questions
                </span>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  Questions, answered honestly.
                </h2>
                <p className="mt-4 text-base text-ink-secondary leading-relaxed">
                  Everything you need to know about our fact-checked career profile, Chrome extension, and Australian hiring conventions.
                </p>
              </Reveal>
            </div>

            {/* Right Column: Accordion */}
            <div className="lg:col-span-7">
              <Reveal delay={0.1}>
                <Accordion items={accordionItems} />
              </Reveal>
            </div>
          </div>
        </div>

        {/* Centred Outcome-Led Final CTA */}
        <div className="mx-auto mt-24 max-w-3xl flex flex-col items-center text-center border-t border-border pt-20">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[52px] lg:leading-[1.08] font-bold text-ink tracking-tight">
              Stop job hunting like it&rsquo;s 2015.
            </h2>
            <p className="mt-5 text-base text-ink-secondary sm:text-lg max-w-xl mx-auto leading-relaxed">
              One profile. One workspace. Every application. From finding the role on SEEK to signing your offer letter, ApplyLab is your Australian job-search copilot.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link href="/signup">
                <Button size="lg" className="shadow-md px-8 py-3.5 text-base font-bold transition-transform active:scale-95">
                  Start for free &rarr;
                </Button>
              </Link>
              <p className="text-xs text-ink-muted">
                2 applications free &middot; No credit card required &middot; Built for Australian jobs 🇦🇺
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
