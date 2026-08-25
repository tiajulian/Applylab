"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";

export function InteractiveHeroShowcase() {
  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pt-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Top Hero Headline Block */}
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
              <span>Built for the Australian job market</span>
              <span role="img" aria-label="Australia">🇦🇺</span>
            </span>
          </Reveal>

          <Reveal delay={0.06}>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl sm:leading-[1.12]">
              You&rsquo;re more qualified than your resume makes you look.
            </h1>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-5 text-lg text-ink-secondary sm:text-xl leading-relaxed">
              Tell ApplyLab what you&rsquo;ve actually done — it matches your real experience to the job and writes the resume, without inventing anything.
            </p>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="shadow-md transition-transform hover:-translate-y-0.5 px-7 py-3 text-base">
                  Build my resume free
                </Button>
              </Link>
              <a
                href="#interactive-demo"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:text-ink min-h-[44px] px-4 py-2 rounded-full border border-border bg-surface hover:bg-paper-deep"
              >
                See how it works
                <span className="transition-transform group-hover:translate-y-0.5">&darr;</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.28}>
            <p className="mt-4 text-xs font-medium text-ink-muted">
              2 resumes free &middot; No credit card &middot; Built for Australian jobs
            </p>
          </Reveal>
        </div>

        {/* Tangible proof: one real match, visible without scrolling */}
        <div className="mt-12 mx-auto max-w-lg">
          <Reveal delay={0.32}>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-pop sm:p-6">
              <div className="flex items-center justify-between">
                <span className="rounded bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
                  SEEK requirement: Stakeholder management
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-success">
                  <CountUp value={94} suffix="%" /> match
                </span>
              </div>
              <p className="mt-3 text-xs italic text-ink-secondary">
                &ldquo;Handled customer complaints and staff scheduling on the floor.&rdquo;
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-success/20 bg-success-soft/20 p-3">
                <span className="text-success">&#10003;</span>
                <p className="text-xs font-medium text-ink leading-relaxed">
                  Managed escalated customer concerns and internal stakeholder communications to resolve operational challenges efficiently.
                </p>
              </div>
              <a
                href="#interactive-demo"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                See the full match &darr;
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

