"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const BEFORE_AFTER_EXAMPLES = [
  {
    id: "customers",
    youSaid: "I dealt with angry customers all day.",
    recognised: ["Conflict resolution", "Stakeholder management", "Problem solving", "Communication under pressure"],
    yourResume: "Resolved escalated customer concerns while maintaining service standards in high-pressure situations.",
  },
  {
    id: "cash",
    youSaid: "I counted the cash drawer and locked up at night.",
    recognised: ["Financial reconciliation", "Audit compliance", "Security protocols", "Operational integrity"],
    yourResume: "Executed daily financial reconciliation and maintained strict site security and cash compliance protocols.",
  },
  {
    id: "roster",
    youSaid: "I organized shifts when people called in sick.",
    recognised: ["Real-time resourcing", "Schedule coordination", "Crisis management", "Team leadership"],
    yourResume: "Managed dynamic shift rescheduling and resource allocation to ensure continuous operational coverage.",
  },
];

export function BeforeAfterTranslationSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = BEFORE_AFTER_EXAMPLES[activeIdx];

  return (
    <section className="py-20 bg-surface">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Core Translation Principle
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              The problem isn&rsquo;t always your experience.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg leading-relaxed">
              Sometimes you&rsquo;ve already done the work. You just haven&rsquo;t described it in the language employers are looking for.
            </p>
          </Reveal>
        </div>

        {/* Interactive Example Switcher */}
        <div className="mt-12 mx-auto max-w-4xl">
          <div className="flex justify-center gap-2 mb-8">
            {BEFORE_AFTER_EXAMPLES.map((ex, idx) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  idx === activeIdx
                    ? "bg-ink text-paper shadow-sm"
                    : "bg-paper-deep text-ink-secondary hover:text-ink border border-border"
                }`}
              >
                Example {idx + 1}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-paper p-6 sm:p-10 shadow-pop">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* YOU SAID */}
              <div className="md:col-span-4 rounded-xl border border-border bg-surface p-5 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  YOU SAID
                </span>
                <p className="mt-3 font-display text-base italic text-ink">
                  &ldquo;{active.youSaid}&rdquo;
                </p>
              </div>

              {/* APPLYLAB RECOGNISED */}
              <div className="md:col-span-4 flex flex-col items-center justify-center rounded-xl border border-accent/30 bg-accent-soft/40 p-5 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  APPLYLAB RECOGNISED
                </span>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {active.recognised.map((rec) => (
                    <span
                      key={rec}
                      className="rounded bg-surface px-2.5 py-1 text-xs font-semibold text-accent border border-accent/20"
                    >
                      ✓ {rec}
                    </span>
                  ))}
                </div>
              </div>

              {/* YOUR RESUME */}
              <div className="md:col-span-4 rounded-xl border border-success/40 bg-success-soft/30 p-5 text-left">
                <span className="text-xs font-bold uppercase tracking-wider text-success">
                  YOUR RESUME
                </span>
                <p className="mt-3 font-sans text-xs sm:text-sm font-semibold text-ink leading-relaxed">
                  • {active.yourResume}
                </p>
              </div>
            </div>

            <div className="mt-8 text-center border-t border-border/80 pt-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-success/15 px-4 py-1.5 text-xs font-bold text-success border border-success/30">
                <span>Same experience. Better translation.</span>
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
