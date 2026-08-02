"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { EASE } from "@/lib/motion";

const PAIRS = [
  {
    resume: "Resolved escalated customer concerns independently",
    source: "“I handled complaints on the floor without needing a manager”",
  },
  {
    resume: "Maintained high-accuracy financial reconciliation",
    source: "“I balanced the till to the cent at close, every shift”",
  },
];

function TraceConnector() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center py-1" aria-hidden="true">
      <svg width="2" height="36" viewBox="0 0 2 36" className="text-border-strong">
        <motion.line
          x1="1"
          y1="0"
          x2="1"
          y2="36"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 4"
          strokeLinecap="round"
          initial={reduceMotion ? undefined : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </svg>
      <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-pill bg-success-soft text-xs text-success">
        ✓
      </span>
    </div>
  );
}

export function HonestySection() {
  return (
    <section className="py-20">
      <Container size="4xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">
            We will never put words in your mouth.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-3 max-w-2xl text-center text-body-lg text-ink-secondary">
            Every line traces back to something you actually told us. No invented jobs, no fake
            numbers, nothing you can&rsquo;t defend in an interview. That&rsquo;s the difference
            between a resume that gets you in the room and one that gets you caught out.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-8">
          {PAIRS.map((pair) => (
            <Reveal key={pair.resume}>
              <div className="flex flex-col items-center rounded border border-border bg-surface p-5 text-center">
                <span className="text-meta font-medium uppercase tracking-wide text-ink-muted">
                  On your resume
                </span>
                <p className="mt-2 text-sm font-medium text-ink">{pair.resume}</p>
                <TraceConnector />
                <span className="text-meta font-medium uppercase tracking-wide text-ink-muted">
                  What you told us
                </span>
                <p className="mt-2 text-sm text-ink-secondary">{pair.source}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
