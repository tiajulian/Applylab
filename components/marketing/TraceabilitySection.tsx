"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { Container } from "@/components/marketing/Container";
import { EASE } from "@/lib/motion";

export function TraceabilitySection() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-t border-border bg-paper-deep py-20">
      <Container size="5xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">
            We will never put words in your mouth.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-3 max-w-xl text-center text-body-lg text-ink-secondary">
            Every line traces back to something you actually told us. No invented jobs, no fake
            numbers &mdash; nothing you can&rsquo;t defend in an interview.
          </p>
        </Reveal>

        <StaggerList className="mt-10 grid gap-4 sm:grid-cols-3">
          <StaggerItem className="rounded-lg border border-success/30 bg-success-soft p-5">
            <p className="text-meta font-bold uppercase tracking-wide text-success">
              Confirmed and added
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              Matched: Data accuracy &amp; reconciliation
            </p>
            <p className="mt-1.5 text-sm italic text-ink-secondary">
              &ldquo;Balanced the till to the cent, every close&rdquo;
            </p>
          </StaggerItem>

          <StaggerItem>
            <button
              type="button"
              onClick={() => setConfirmOpen((open) => !open)}
              aria-expanded={confirmOpen}
              className="w-full rounded-lg border border-attention/30 bg-attention-soft p-5 text-left transition-transform duration-fast ease-editorial hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="text-meta font-bold uppercase tracking-wide text-attention">
                Worth confirming
              </p>
              <p className="mt-2 text-sm font-semibold text-ink">Kept the shift roster running</p>
              <AnimatePresence mode="wait" initial={false}>
                {confirmOpen ? (
                  <motion.p
                    key="detail"
                    initial={reduceMotion ? undefined : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="mt-1.5 text-sm text-ink-secondary"
                  >
                    We think this could be <em>resource planning</em> or{" "}
                    <em>budget forecasting</em> &mdash; tell us more to confirm.
                  </motion.p>
                ) : (
                  <motion.p
                    key="teaser"
                    initial={reduceMotion ? undefined : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="mt-1.5 text-sm font-medium text-attention"
                  >
                    Tap to see what this could prove &rarr;
                  </motion.p>
                )}
              </AnimatePresence>
            </button>
          </StaggerItem>

          <StaggerItem className="rounded-lg border border-border-strong bg-surface p-5">
            <p className="text-meta font-bold uppercase tracking-wide text-ink-muted">
              Honest gap
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">No matching experience found</p>
            <p className="mt-1.5 text-sm text-ink-secondary">
              We won&rsquo;t add this unless you tell us about it.
            </p>
          </StaggerItem>
        </StaggerList>
      </Container>
    </section>
  );
}
