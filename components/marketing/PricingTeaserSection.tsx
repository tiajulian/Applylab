"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { clsx } from "@/lib/utils";
import { EASE } from "@/lib/motion";

const PLANS = {
  monthly: { price: "$19", cadence: "AUD / month" },
  lifetime: { price: "$79", cadence: "once, forever" },
} as const;

export function PricingTeaserSection() {
  const [plan, setPlan] = useState<keyof typeof PLANS>("monthly");
  const reduceMotion = useReducedMotion();

  return (
    <section className="border-t border-border bg-paper-deep py-20">
      <Container size="3xl" className="text-center">
        <Reveal>
          <h2 className="font-display text-h2 text-ink">Start free. Upgrade when you&rsquo;re ready.</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-secondary">
            Two resumes, no card needed. Go Pro for unlimited resumes, ATS scoring, and exports.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mx-auto mt-10 max-w-sm rounded border border-border bg-surface p-6 shadow-sm">
            <div
              role="group"
              aria-label="Choose billing"
              className="mx-auto flex w-fit gap-1 rounded-pill bg-paper-deep p-1"
            >
              {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={plan === key}
                  onClick={() => setPlan(key)}
                  className={clsx(
                    "rounded-pill px-3 py-1.5 text-sm font-medium transition-colors duration-fast ease-editorial",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    plan === key ? "bg-accent text-on-accent" : "text-ink-secondary hover:text-ink"
                  )}
                >
                  {key === "monthly" ? "Monthly" : "Once, forever"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={plan}
                initial={reduceMotion ? undefined : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="mt-5"
              >
                <span className="font-display text-h2 text-ink">{PLANS[plan].price}</span>{" "}
                <span className="text-ink-secondary">{PLANS[plan].cadence}</span>
              </motion.p>
            </AnimatePresence>

            <Link href="/signup" className="mt-6 block">
              <Button size="lg" className="w-full">
                Build your first resume free
              </Button>
            </Link>
            <Link
              href="/upgrade"
              className="mt-3 inline-block text-sm text-ink-secondary underline decoration-border-strong underline-offset-4 transition-colors duration-fast ease-editorial hover:text-ink"
            >
              See full plans
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
