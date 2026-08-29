"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

export function InteractiveHeroShowcase() {
  const [activeTab, setActiveTab] = useState<"evidence" | "gaps">("evidence");

  return (
    <section className="relative overflow-hidden py-14 lg:py-20 bg-paper">
      <Container size="marketing">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
          {/* Left Column: Headline, Lede, CTAs */}
          <div className="flex flex-col items-start text-left">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent">
                <span>Built for the Australian job market</span>
                <span role="img" aria-label="Australia">
                  🇦🇺
                </span>
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-[64px] lg:leading-[1.02]">
                From job ad
                <br />
                to job offer.
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-[46ch] text-body-lg text-ink-secondary leading-relaxed">
                Find roles worth applying to, understand your match, tailor your resume and cover letter, autofill applications on SEEK &amp; Workday, and walk into interviews prepared, all powered by one verified career profile.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <Link href="/resume-score" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto px-7 py-3 text-base shadow-sm transition-transform active:scale-[0.98]">
                    Score your resume free &rarr;
                  </Button>
                </Link>
                <Link
                  href="/onboarding"
                  className="group inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-all hover:bg-paper-deep hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Start onboarding
                  <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <p className="mt-4 text-meta text-ink-muted text-center sm:text-left">
                2 applications free &middot; No credit card &middot; AU English, 04xx, one page
              </p>
            </Reveal>
          </div>

          {/* Right Column: Product Mock A (Job Match Card) */}
          <Reveal delay={0.2}>
            <div className="relative">
              {/* Background ambient glow circle */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-6 h-64 w-64 rounded-full bg-accent-soft/50 blur-3xl"
              />

              <div className="relative rounded-lg border border-border bg-paper-deep shadow-pop overflow-hidden transition-all duration-300 hover:shadow-pop-lg">
                {/* Fake Browser Bar */}
                <div className="flex items-center justify-between border-b border-border bg-surface/80 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted truncate max-w-[210px] sm:max-w-none">
                    applylab.au/match/rosterly-implementation-analyst
                  </span>
                  <div className="w-8" />
                </div>

                {/* Card Content Ground */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Job Header & Match Score */}
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-4 bg-surface rounded-lg p-4 border shadow-sm">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        Target Role Match
                      </span>
                      <h3 className="mt-0.5 font-display text-lg sm:text-xl font-bold text-ink">
                        Implementation Analyst
                      </h3>
                      <p className="mt-0.5 text-xs text-ink-secondary">
                        Rosterly &middot; Cremorne VIC &middot; pasted from SEEK
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-baseline gap-0.5">
                        <span className="font-display text-3xl font-bold text-ink">78</span>
                        <span className="text-xs font-semibold text-ink-muted">/100</span>
                      </div>
                      <span className="mt-0.5 inline-block rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success border border-success/30">
                        Strong Fit
                      </span>
                    </div>
                  </div>

                  {/* 2-Tab Segmented Control with animated indicator */}
                  <div className="relative flex rounded-md border border-border bg-paper p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("evidence")}
                      className={`relative z-10 flex-1 rounded py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        activeTab === "evidence" ? "text-ink" : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      Backed by evidence &middot; 6
                      {activeTab === "evidence" && (
                        <motion.span
                          layoutId="heroTabIndicator"
                          className="absolute inset-0 -z-10 rounded bg-surface shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("gaps")}
                      className={`relative z-10 flex-1 rounded py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        activeTab === "gaps" ? "text-ink" : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      Honest gaps &middot; 2
                      {activeTab === "gaps" && (
                        <motion.span
                          layoutId="heroTabIndicator"
                          className="absolute inset-0 -z-10 rounded bg-surface shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </button>
                  </div>

                  {/* Tab Panels with AnimatePresence */}
                  <div className="min-h-[175px]">
                    <AnimatePresence mode="wait">
                      {activeTab === "evidence" ? (
                        <motion.div
                          key="evidence-tab"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-2.5"
                        >
                          <div className="rounded-lg border border-success/20 bg-success-soft p-3 transition-transform hover:scale-[1.01]">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-success font-bold text-xs">&#10003;</span>
                              <div className="text-xs">
                                <p className="font-semibold text-ink">
                                  Workflow Optimisation &amp; System Rollouts
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary">
                                  Verified duty &middot; Venue Manager, Marlowe Hospitality, 2019-2024
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-success/20 bg-success-soft p-3 transition-transform hover:scale-[1.01]">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-success font-bold text-xs">&#10003;</span>
                              <div className="text-xs">
                                <p className="font-semibold text-ink">
                                  Stakeholder Management &amp; Training
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary">
                                  Verified duty &middot; Venue Manager, Marlowe Hospitality, 2019-2024
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-border bg-surface p-3 transition-transform hover:scale-[1.01]">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-ink-muted text-xs">◐</span>
                              <div className="text-xs">
                                <p className="font-medium text-ink">
                                  Partial - phrased as transferable, never as experience
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary">
                                  Data Analysis &amp; Excel reporting &middot; Marlowe Hospitality
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="gaps-tab"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-2.5"
                        >
                          <div className="rounded-lg border border-attention/30 bg-attention-soft p-3 transition-transform hover:scale-[1.01]">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-attention font-bold text-xs">&#10005;</span>
                              <div className="text-xs">
                                <p className="font-semibold text-ink">Advanced SQL</p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary leading-relaxed">
                                  Nothing in your verified history supports this. We won&rsquo;t add it, and we won&rsquo;t soften it to &ldquo;exposure to SQL&rdquo; either.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-attention/30 bg-attention-soft p-3 transition-transform hover:scale-[1.01]">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-attention font-bold text-xs">&#10005;</span>
                              <div className="text-xs">
                                <p className="font-semibold text-ink">Multi-site change management</p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary leading-relaxed">
                                  Becomes a drilled interview question to prepare for, not a fake resume bullet.
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-border pt-3.5 text-xs">
                    <span className="text-[11px] font-medium text-ink-muted">
                      Matched against 2 roles, 14 confirmed duties, 6 wins
                    </span>
                    <a href="#tailored-resume">
                      <Button size="sm" className="text-xs font-bold px-3 py-1 transition-transform active:scale-95">
                        Tailor resume &rarr;
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}



