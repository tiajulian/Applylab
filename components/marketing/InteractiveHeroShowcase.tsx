"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { HERO_PRESETS } from "@/lib/marketingBridgeData";
import { AnimatePresence, motion } from "framer-motion";

export function InteractiveHeroShowcase() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("retail-ops");

  const activePreset = HERO_PRESETS.find((p) => p.id === selectedPresetId) || HERO_PRESETS[0];

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
              Turn the experience you already have into a resume tailored to the job you actually want — without inventing anything.
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

        {/* Interactive Product Demo Interface */}
        <div id="interactive-demo" className="mt-14 scroll-mt-24">
          <Reveal delay={0.32}>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-pop sm:p-8">
              {/* Header & Subhead */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
                <div>
                  <span className="text-meta font-semibold uppercase tracking-wider text-accent">Interactive Demo</span>
                  <h2 className="mt-1 font-display text-2xl font-bold text-ink">
                    See what ApplyLab does with your experience
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span>Real experience translation</span>
                </div>
              </div>

              {/* Preset Selector Chips */}
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
                  Try another example:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {HERO_PRESETS.map((preset) => {
                    const isSelected = preset.id === selectedPresetId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-fast ${
                          isSelected
                            ? "bg-accent text-on-accent shadow-sm"
                            : "bg-paper-deep border border-border text-ink-secondary hover:text-ink hover:border-border-strong"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3-Column Progressive Interface */}
              <div className="mt-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePreset.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch"
                  >
                    {/* Column 1: What you did */}
                    <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-border bg-paper p-5">
                      <div>
                        <div className="flex items-center justify-between border-b border-border/60 pb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                            1. What you did
                          </span>
                          <span className="rounded bg-paper-deep px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                            {activePreset.fromRole}
                          </span>
                        </div>
                        <p className="mt-4 font-display text-base font-medium text-ink italic leading-relaxed">
                          &ldquo;{activePreset.whatYouDid}&rdquo;
                        </p>
                      </div>
                      <p className="mt-6 text-[11px] text-ink-muted">
                        In plain, everyday human language
                      </p>
                    </div>

                    {/* Column 2: What ApplyLab understands */}
                    <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-accent/30 bg-accent-soft/30 p-5">
                      <div>
                        <div className="flex items-center justify-between border-b border-accent/20 pb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-accent">
                            2. What ApplyLab understands
                          </span>
                          <span className="text-xs text-accent">✨ Analysis</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {activePreset.understands.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 rounded-md bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink shadow-sm border border-accent/20"
                            >
                              <span className="text-accent">&#10003;</span> {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-6 text-[11px] font-medium text-accent">
                        Identifies transferable competencies
                      </p>
                    </div>

                    {/* Column 3: How it becomes resume-ready */}
                    <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-success/30 bg-success-soft/20 p-5">
                      <div>
                        <div className="flex items-center justify-between border-b border-success/20 pb-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-success">
                            3. Resume-ready
                          </span>
                          <span className="rounded bg-success/20 px-2 py-0.5 text-[11px] font-semibold text-success">
                            For {activePreset.toRole}
                          </span>
                        </div>
                        <p className="mt-4 font-sans text-xs sm:text-sm font-medium text-ink leading-relaxed">
                          • {activePreset.resumeReady}
                        </p>
                      </div>
                      <div className="mt-6 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-success">✓ Based strictly on your input</span>
                        <span className="text-ink-muted">100% Australian English</span>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

