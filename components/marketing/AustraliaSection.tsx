"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const AU_MARKET_CARDS = [
  {
    title: "SEEK",
    badge: "SEEK Ready",
    desc: "Optimised for Australian job ads, SEEK terminology, and local recruiter scanning patterns.",
  },
  {
    title: "Workday",
    badge: "Enterprise Portals",
    desc: "Structured to work smoothly with corporate Workday, SuccessFactors, and Taleo application portals.",
  },
  {
    title: "Australian English",
    badge: "100% AU Spelling",
    desc: "Uses authentic Australian spelling (e.g. organised, prioritised, behaviour) and local phrasing.",
  },
  {
    title: "One-Page Resumes",
    badge: "Strict 1-Page Layout",
    desc: "Designed to keep applications concise, punchy, and scannable without unnecessary fluff.",
  },
];

export function AustraliaSection() {
  return (
    <section className="py-14 bg-surface">
      <Container size="6xl">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent">
              <span>Local Market Focus</span> 🇦🇺
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Built for the way Australians actually apply.
            </h2>
          </Reveal>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AU_MARKET_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-border bg-paper p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-pop"
            >
              <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                {card.badge}
              </span>
              <h3 className="mt-2.5 font-display text-base font-bold text-ink">
                {card.title}
              </h3>
              <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
