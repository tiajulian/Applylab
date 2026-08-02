"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { EASE } from "@/lib/motion";

const WORD_PAIRS = [
  { before: "Till reconciliation", after: "Data accuracy" },
  { before: "Roster wrangling", after: "Resource coordination" },
  { before: "Complaint handling", after: "Stakeholder resolution" },
];

export function EmpathySection() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % WORD_PAIRS.length);
    }, 2600);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <section className="border-t border-border bg-paper-deep py-20">
      <Container size="3xl" className="text-center">
        <Reveal>
          <h2 className="font-display text-h2 text-ink">You&rsquo;ve done the work. You just can&rsquo;t see it.</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-4 text-body-lg text-ink-secondary">
            You read the job ad and think &ldquo;that&rsquo;s not me.&rdquo; But you&rsquo;ve already
            done half of it, under different words. You just never translated it, so the filters
            never saw you.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mx-auto mt-10 flex h-12 max-w-sm items-center justify-center gap-3 rounded-pill border border-border-strong bg-surface px-5 text-sm">
            {reduceMotion ? (
              <div className="flex flex-col gap-2 py-2 text-left">
                {WORD_PAIRS.map((pair) => (
                  <p key={pair.before} className="text-ink-secondary">
                    <span className="text-ink-muted line-through">{pair.before}</span>
                    <span className="mx-2 text-ink-muted">&rarr;</span>
                    <span className="font-medium text-accent">{pair.after}</span>
                  </p>
                ))}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.p
                  key={WORD_PAIRS[index].before}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  className="whitespace-nowrap"
                >
                  <span className="text-ink-muted line-through">{WORD_PAIRS[index].before}</span>
                  <span className="mx-2 text-ink-muted">&rarr;</span>
                  <span className="font-medium text-accent">{WORD_PAIRS[index].after}</span>
                </motion.p>
              </AnimatePresence>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
