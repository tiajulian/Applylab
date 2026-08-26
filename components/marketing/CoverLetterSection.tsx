"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

export function CoverLetterSection() {
  return (
    <section id="cover-letter" className="scroll-mt-24 py-20 bg-surface border-t border-border">
      <Container size="5xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Pillar 5 &middot; Role-Specific Cover Letters
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              One click from tailored resume to tailored cover letter.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Generic cover letters get ignored. ApplyLab drafts a targeted, 3-paragraph letter matching the employer&rsquo;s specific challenges using your verified work achievements.
            </p>
          </Reveal>
        </div>

        {/* Compact Cover Letter Preview */}
        <div className="mt-10 mx-auto max-w-2xl">
          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-border bg-paper p-6 sm:p-8 shadow-pop">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Cover Letter &middot; Metro Logistics &amp; Services
                </span>
                <span className="rounded bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  100% Evidence Grounded
                </span>
              </div>

              <div className="mt-5 space-y-3.5 text-xs sm:text-sm text-ink leading-relaxed font-serif">
                <p className="font-sans text-xs text-ink-secondary">
                  Dear Hiring Team at Metro Logistics,
                </p>
                <p>
                  Metro Logistics&rsquo; operations team needs an Operations Coordinator who can maintain composure under pressure and resolve complex floor escalations independently. That is exactly what I have done over the past three years at Bondi Junction.
                </p>
                <p>
                  In my previous role as Retail Shift Supervisor, I led a shift team of 14, spearheaded stockroom reorganisation protocols that reduced inventory retrieval cycles by 35%, and maintained perfect daily financial reconciliation across 6 POS registers. I understand the logistical tempo required for your hybrid Sydney distribution hub.
                </p>
                <p>
                  I look forward to discussing how my operational coordination and stakeholder management experience can support your team from day one.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-ink-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="text-success font-bold">✓</span> Australian business tone
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-success font-bold">✓</span> Direct PDF &amp; Word download
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-success font-bold">✓</span> Zero hallucinated details
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
