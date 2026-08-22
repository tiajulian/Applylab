"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

type HighlightMode = "seek" | "metrics" | "au_english";

export function InteractiveHeroShowcase() {
  const [activeHighlight, setActiveHighlight] = useState<HighlightMode>("seek");

  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pt-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Messaging & CTAs */}
          <div className="flex flex-col items-start text-left lg:col-span-6">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
                <span>Built for the Australian job market</span>
                <span role="img" aria-label="Australia">🇦🇺</span>
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-5 font-display text-display font-semibold text-ink sm:text-5xl sm:leading-[1.15]">
                You&rsquo;re more qualified than your resume makes you look.
              </h1>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="mt-5 text-body-lg text-ink-secondary">
                ApplyLab turns the experience you already have into a resume that speaks the language of the job you want. Tailored to the ad, ready for Australian hiring systems, and never invented.
              </p>
            </Reveal>

            <Reveal delay={0.22}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/signup">
                  <Button size="lg" className="shadow-md transition-transform hover:-translate-y-0.5">
                    Build your first resume free
                  </Button>
                </Link>
                <a
                  href="#interactive-demo"
                  className="group inline-flex items-center gap-1 text-sm font-medium text-ink-secondary transition-colors hover:text-ink min-h-[44px]"
                >
                  See how it works
                  <span className="transition-transform group-hover:translate-y-0.5">&darr;</span>
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.28}>
              <p className="mt-4 text-xs text-ink-muted">
                No credit card required for your first 2 resumes &middot; 100% Australian English
              </p>
            </Reveal>
          </div>

          {/* Right Column: Interactive Resume Showcase Component */}
          <div className="lg:col-span-6">
            <Reveal delay={0.15}>
              <div className="relative rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-pop">
                {/* Header Bar: ATS Score Meter + Filter Chips */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                  {/* Circular ATS Gauge */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent font-bold">
                      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-border"
                          strokeWidth="3"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-accent"
                          strokeDasharray="94, 100"
                          strokeWidth="3"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="text-xs font-extrabold text-accent">94</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">SEEK ATS Match</p>
                      <p className="text-sm font-bold text-ink">94/100 Optimised</p>
                    </div>
                  </div>

                  {/* Filter Toggles */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveHighlight("seek")}
                      className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeHighlight === "seek"
                          ? "bg-accent text-on-accent"
                          : "bg-paper-deep text-ink-secondary hover:text-ink"
                      }`}
                    >
                      🎯 SEEK Keywords
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHighlight("metrics")}
                      className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeHighlight === "metrics"
                          ? "bg-accent text-on-accent"
                          : "bg-paper-deep text-ink-secondary hover:text-ink"
                      }`}
                    >
                      ⚡ High-Impact Metrics
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHighlight("au_english")}
                      className={`min-h-[36px] rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeHighlight === "au_english"
                          ? "bg-accent text-on-accent"
                          : "bg-paper-deep text-ink-secondary hover:text-ink"
                      }`}
                    >
                      🇦🇺 AU English
                    </button>
                  </div>
                </div>

                {/* Resume Card Preview */}
                <div className="mt-4 flex flex-col gap-3 font-sans">
                  {/* Candidate Header Mockup */}
                  <div>
                    <p className="font-display text-lg font-bold text-ink">Alex Taylor</p>
                    <p className="text-xs font-medium text-ink-secondary">
                      Senior Operations & Data Specialist &middot; Sydney, NSW &middot; alex.t@applylab.au
                    </p>
                  </div>

                  <div className="h-px bg-border/60" />

                  {/* Experience Entry Mockup */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">Senior Data Operations Analyst</span>
                      <span className="text-ink-muted">Macquarie Group &middot; 2022 – Present</span>
                    </div>

                    {/* Bullet 1 */}
                    <div className="group relative rounded-md border border-transparent p-2 transition-colors hover:border-border hover:bg-paper-deep/60">
                      <p className="text-xs leading-relaxed text-ink">
                        • Spearheaded end-to-end{" "}
                        <span className={activeHighlight === "seek" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          Snowflake data pipelines
                        </span>{" "}
                        and automated{" "}
                        <span className={activeHighlight === "seek" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          SQL data models
                        </span>
                        , resulting in a{" "}
                        <span className={activeHighlight === "metrics" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          35% run-time reduction
                        </span>{" "}
                        and saving{" "}
                        <span className={activeHighlight === "metrics" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          $15k annually
                        </span>{" "}
                        in cloud compute costs.
                      </p>
                      <span className="absolute right-2 top-2 hidden rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent group-hover:inline-block">
                        ✨ Polished with WinBuilder
                      </span>
                    </div>

                    {/* Bullet 2 */}
                    <div className="group relative rounded-md border border-transparent p-2 transition-colors hover:border-border hover:bg-paper-deep/60">
                      <p className="text-xs leading-relaxed text-ink">
                        •{" "}
                        <span className={activeHighlight === "au_english" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          Optimised
                        </span>{" "}
                        and{" "}
                        <span className={activeHighlight === "au_english" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          prioritised
                        </span>{" "}
                        weekly sprint backlogs across 3 cross-functional teams, driving transparent{" "}
                        <span className={activeHighlight === "seek" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          Stakeholder Management
                        </span>{" "}
                        and eliminating{" "}
                        <span className={activeHighlight === "metrics" ? "rounded bg-accent/20 px-1 font-semibold text-accent" : ""}>
                          10+ hours weekly
                        </span>{" "}
                        of manual reporting.
                      </p>
                      <span className="absolute right-2 top-2 hidden rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent group-hover:inline-block">
                        ✨ Polished with WinBuilder
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
