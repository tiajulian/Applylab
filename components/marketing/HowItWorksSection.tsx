"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { Container } from "@/components/marketing/Container";
import { EASE } from "@/lib/motion";

const STEPS = [
  {
    label: "1",
    title: "Add your history and paste the job ad.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="h-10 w-10">
        <rect x="8" y="6" width="24" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 14h14M13 20h14M13 26h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "2",
    title: "Confirm what's true. We suggest the transferable skills you might have, you tick the real ones.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="h-10 w-10">
        <rect x="7" y="7" width="26" height="26" rx="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 20l4 4 8-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "3",
    title: "Get an honest, tailored, one-page resume, ready to download.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className="h-10 w-10">
        <path d="M20 6v20m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 28v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="py-20">
      <Container size="5xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">
            Three steps. No guesswork.
          </h2>
        </Reveal>

        <div className="relative mt-14">
          <motion.div
            aria-hidden="true"
            initial={reduceMotion ? undefined : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{ transformOrigin: "left" }}
            className="absolute left-[16.5%] right-[16.5%] top-5 hidden h-px bg-border-strong sm:block"
          />

          <StaggerList className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step) => (
              <StaggerItem key={step.label} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-pill bg-accent text-sm font-semibold text-on-accent">
                  {step.label}
                </div>
                <div className="mt-5 text-accent">{step.icon}</div>
                <p className="mt-4 max-w-[22ch] text-body text-ink-secondary">{step.title}</p>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </Container>
    </section>
  );
}
