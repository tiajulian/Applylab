"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { Accordion } from "@/components/marketing/Accordion";
import { FAQ_ITEMS } from "@/lib/marketingBridgeData";

export function FaqSection() {
  const accordionItems = FAQ_ITEMS.map((item) => ({
    question: item.question,
    answer: item.answer,
  }));

  return (
    <section className="py-20 bg-surface">
      <Container size="4xl">
        <div className="mx-auto text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Frequently Asked Questions
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Questions, answered honestly.
            </h2>
            <p className="mt-3 text-base text-ink-secondary">
              Everything you need to know about ApplyLab, ATS compatibility, and how your data is handled.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-10">
            <Accordion items={accordionItems} />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
