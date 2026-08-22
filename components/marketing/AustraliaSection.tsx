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
    <section className="py-20 bg-surface">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent">
              <span>Local Market Focus</span> 🇦🇺
            </span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Built for the way Australians actually apply.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Designed to make your experience easier for recruiters and application systems to understand.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {AU_MARKET_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-border bg-paper p-6 shadow-sm hover:shadow-pop transition-all hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <span className="rounded bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent">
                  {card.badge}
                </span>
                <h3 className="mt-3 font-display text-xl font-bold text-ink">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
                  {card.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
