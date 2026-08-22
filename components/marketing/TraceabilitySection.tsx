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
            <div className="rounded-lg border border-attention/30 bg-attention-soft p-5 text-left">
              <div className="flex items-center justify-between">
                <p className="text-meta font-bold uppercase tracking-wide text-attention">
                  Worth confirming (Curiosity Trigger)
                </p>
                <span className="rounded bg-attention/20 px-1.5 py-0.5 text-[10px] font-bold text-attention">
                  3 Hidden Skills
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">
                &ldquo;Kept the shift roster running&rdquo;
              </p>

              <button
                type="button"
                onClick={() => setConfirmOpen((open) => !open)}
                aria-expanded={confirmOpen}
                className="mt-3 flex w-full items-center justify-between rounded-md bg-paper border border-attention/30 px-3 py-2 text-xs font-bold text-ink transition-all hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{confirmOpen ? "🔒 Hide executive skills" : "🔓 Tap to see 3 hidden executive skills this proves →"}</span>
              </button>

              <AnimatePresence mode="wait" initial={false}>
                {confirmOpen && (
                  <motion.div
                    key="detail"
                    initial={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="mt-3 overflow-hidden border-t border-attention/20 pt-2"
                  >
                    <p className="text-xs font-semibold text-ink-muted mb-1.5">Confirmed Executive Translation:</p>
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="rounded bg-surface px-2 py-1 font-medium text-ink border border-border">
                        ✓ <strong>Workforce Scheduling</strong> (Roster budgeting)
                      </span>
                      <span className="rounded bg-surface px-2 py-1 font-medium text-ink border border-border">
                        ✓ <strong>Fair Work Award Compliance</strong> (AU Labour rules)
                      </span>
                      <span className="rounded bg-surface px-2 py-1 font-medium text-ink border border-border">
                        ✓ <strong>Cross-Functional Team Leadership</strong> (Floor ops)
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </StaggerItem>

          <StaggerItem className="rounded-lg border border-border-strong bg-surface p-5">
            <p className="text-meta font-bold uppercase tracking-wide text-ink-muted">
              Honest gap
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">No matching experience found</p>
            <p className="mt-1.5 text-sm text-ink-secondary">
              We never invent experience. Gaps stay gaps until you add them.
            </p>
          </StaggerItem>
        </StaggerList>
      </Container>
    </section>
  );
}
