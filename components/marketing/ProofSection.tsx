"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { TESTIMONIALS } from "@/lib/marketingBridgeData";

export function ProofSection() {
  return (
    <section className="py-20 bg-surface border-t border-border">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Real Australian Success Stories
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Real career transitions, zero invented facts.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Here is how job seekers transformed their past experience into tailored applications that landed interviews.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-paper p-6 sm:p-8 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h4 className="font-display text-lg font-bold text-ink">{item.name}</h4>
                    <p className="text-xs font-medium text-ink-muted">{item.location}</p>
                  </div>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">
                    {item.fromRole} &rarr; {item.toRole}
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-xs sm:text-sm">
                  <div className="rounded-lg bg-paper-deep p-3 border border-border/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                      BEFORE:
                    </span>
                    <p className="mt-1 text-ink-secondary italic">&ldquo;{item.before}&rdquo;</p>
                  </div>

                  <div className="rounded-lg bg-accent-soft/30 p-3 border border-accent/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      AFTER APPLYLAB:
                    </span>
                    <p className="mt-1 font-medium text-ink">&ldquo;{item.after}&rdquo;</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-success-soft/30 p-3 text-xs font-bold text-success border border-success/20 flex items-center gap-2">
                <span>✓</span>
                <span>Result: {item.result}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
