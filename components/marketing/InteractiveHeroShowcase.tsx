"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { CheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { PROOF_FIGURES } from "@/lib/marketingProofData";

export function InteractiveHeroShowcase() {
  const [activeTab, setActiveTab] = useState<"evidence" | "gaps">("evidence");
  const [autoTabs, setAutoTabs] = useState(true);
  const [displayScore, setDisplayScore] = useState(0);
  const reduceMotion = useReducedMotion();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Motion 1: Count up to 78 over ~900ms on ease-out cubic
  useEffect(() => {
    if (reduceMotion) {
      setDisplayScore(PROOF_FIGURES.heroMatchScore);
      return;
    }

    const duration = 900;
    const startTime = performance.now();
    const target = PROOF_FIGURES.heroMatchScore;

    function animateScore(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic: 1 - (1 - t)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easeProgress * target);
      setDisplayScore(current);

      if (progress < 1) {
        requestAnimationFrame(animateScore);
      }
    }

    const frameId = requestAnimationFrame(animateScore);
    return () => cancelAnimationFrame(frameId);
  }, [reduceMotion]);

  // Motion 2: Match card cycles evidence and gaps every 4.2s until first user click
  useEffect(() => {
    if (reduceMotion || !autoTabs) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setActiveTab((prev) => (prev === "evidence" ? "gaps" : "evidence"));
    }, 4200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoTabs, reduceMotion]);

  function handleTabClick(tab: "evidence" | "gaps") {
    // The first user click stops the cycle permanently
    setAutoTabs(false);
    setActiveTab(tab);
  }

  return (
    <section id="top" className="relative overflow-hidden py-12 sm:py-16 lg:py-24 bg-paper">
      <Container size="marketing">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          {/* Left Column: Moat-Led Headline, Single CTA, Above-the-fold Proof */}
          <div className="flex flex-col items-start text-left">
            <Reveal>
              <div className="tag inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3.5 py-1 text-xs font-semibold text-accent">
                <span>Built for the Australian job market</span>
                <span role="img" aria-label="Australia">
                  🇦🇺
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-4 font-display text-[37px] sm:text-5xl lg:text-[66px] leading-[1.04] font-semibold tracking-tight text-ink">
                Resumes you can actually defend.
                <span className="block mt-2 sm:mt-3 text-[16px] sm:text-2xl lg:text-[28px] font-semibold text-accent leading-snug">
                  Built for how Australia hires.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-[48ch] text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed">
                Stop pasting generic ChatGPT text that invents achievements and falls apart in interviews. ApplyLab grounds every bullet, cover letter, and interview response in your verified career history.
              </p>
            </Reveal>

            {/* CTA Block: Exactly ONE button, secondary link beneath it */}
            <Reveal delay={0.18}>
              <div className="mt-7 flex flex-col items-start gap-3 w-full sm:w-auto">
                <a href="#score" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto px-8 py-3.5 text-base font-bold shadow-sm transition-transform active:scale-[0.98]"
                  >
                    Score your resume free &rarr;
                  </Button>
                </a>
                <Link
                  href="/onboarding"
                  className="text-xs font-semibold text-ink-secondary hover:text-ink transition-colors underline-offset-4 hover:underline px-1"
                >
                  Or build your full profile &rarr;
                </Link>
                <p className="text-meta text-ink-muted leading-tight">
                  Free score takes an existing resume. Matching needs your full profile.
                </p>
              </div>
            </Reveal>

            {/* Above-the-fold Proof: Chrome rating & user count divided by a hairline */}
            <Reveal delay={0.24}>
              <div className="mt-8 flex items-center gap-4 text-xs text-ink-muted border-t border-border pt-4">
                <div className="flex items-center gap-1 font-semibold text-ink">
                  <span className="text-accent font-bold text-sm">★</span>
                  <span>{PROOF_FIGURES.chromeRating}</span>
                  <span className="font-normal text-ink-muted">Chrome rating</span>
                </div>
                <div className="h-3 w-px bg-border" aria-hidden="true" />
                <div className="font-medium">
                  <span className="font-bold text-ink">{PROOF_FIGURES.userCount}</span> job seekers in Australia
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Layered Product Composition (Match card in front, pipeline sliver behind) */}
          <Reveal delay={0.2}>
            <div className="relative isolate">
              {/* Layer 2 (Back): Tracker Pipeline Sliver (Behind & right, rotated 1.6deg, aria-hidden, hidden < 900px) */}
              <div
                aria-hidden="true"
                className="hidden min-[900px]:block pointer-events-none absolute -right-6 top-8 w-full max-w-[420px] rounded-lg border border-border bg-paper-deep/90 p-4 shadow-sm opacity-75 transform rotate-[1.6deg] translate-x-4 -z-10"
              >
                <div className="flex items-center justify-between border-b border-border pb-2 text-[10.5px] font-semibold text-ink-muted">
                  <span>Application Pipeline</span>
                  <span className="text-accent">Auto-Logged SEEK</span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="rounded border border-border bg-surface p-2 text-[11px]">
                    <p className="font-bold text-ink">Rosterly &middot; Implementation Analyst</p>
                    <p className="text-[10px] text-ink-muted">Applied via Extension &middot; Cremorne VIC</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-2 text-[11px] opacity-60">
                    <p className="font-bold text-ink">Atlassian &middot; Operations Specialist</p>
                    <p className="text-[10px] text-ink-muted">Tailoring in progress</p>
                  </div>
                </div>
              </div>

              {/* Layer 1 (Front): Product Mock A (Job Match Card) */}
              <div className="relative rounded-lg border border-border bg-paper-deep shadow-pop overflow-hidden transition-all duration-300 hover:shadow-pop-lg">
                {/* Fake Browser Bar */}
                <div className="flex items-center justify-between border-b border-border bg-surface/80 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted truncate max-w-[210px] sm:max-w-none">
                    applylab.au/match/rosterly-analyst
                  </span>
                  <div className="w-8" />
                </div>

                {/* Card Content */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Job Header & Distinct Job Match Score */}
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-4 bg-surface rounded-lg p-4 border shadow-sm">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        Target Job Match
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
                        <span className="font-display text-3xl font-bold text-ink">
                          {displayScore}
                        </span>
                        <span className="text-xs font-semibold text-ink-muted">/100</span>
                      </div>
                      <span className="mt-0.5 inline-block rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success border border-success/30">
                        Strong Match
                      </span>
                    </div>
                  </div>

                  {/* 2-Tab Segmented Control (Auto-cycles every 4.2s, stops on click) */}
                  <div className="relative flex rounded-md border border-border bg-paper p-1">
                    <button
                      type="button"
                      onClick={() => handleTabClick("evidence")}
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
                      onClick={() => handleTabClick("gaps")}
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

                  {/* Tab Panels */}
                  <div className="min-h-[175px]">
                    <AnimatePresence mode="wait">
                      {activeTab === "evidence" ? (
                        <motion.div
                          key="evidence-tab"
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-2.5"
                        >
                          <div className="rounded-lg border border-success/20 bg-success-soft p-3">
                            <div className="flex items-start gap-2">
                              <CheckIcon className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                              <div className="text-xs">
                                <p className="font-semibold text-ink">
                                  Workflow Optimisation &amp; System Rollouts
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary">
                                  Verified duty &middot; Venue Manager, Marlowe Hospitality
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-success/20 bg-success-soft p-3">
                            <div className="flex items-start gap-2">
                              <CheckIcon className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                              <div className="text-xs">
                                <p className="font-semibold text-ink">
                                  Stakeholder Management &amp; Training
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary">
                                  Verified duty &middot; Marlowe Hospitality, 2019-2024
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Row dropped on small mobile screens */}
                          <div className="hidden sm:block rounded-lg border border-border bg-surface p-3">
                            <div className="flex items-start gap-2">
                              <span className="text-ink-muted text-xs font-mono mt-0.5">◐</span>
                              <div className="text-xs">
                                <p className="font-medium text-ink">
                                  Data Analysis &amp; Excel Reporting
                                </p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary">
                                  Phrased as transferable skill, never as unverified experience
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="gaps-tab"
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-2.5"
                        >
                          <div className="rounded-lg border border-attention/30 bg-attention-soft p-3">
                            <div className="flex items-start gap-2">
                              <XIcon className="w-3.5 h-3.5 text-attention mt-0.5 shrink-0" />
                              <div className="text-xs">
                                <p className="font-semibold text-ink">Advanced SQL</p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary leading-relaxed">
                                  Nothing in your verified profile supports this. ApplyLab flags it honestly instead of faking it.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-attention/30 bg-attention-soft p-3">
                            <div className="flex items-start gap-2">
                              <XIcon className="w-3.5 h-3.5 text-attention mt-0.5 shrink-0" />
                              <div className="text-xs">
                                <p className="font-semibold text-ink">Multi-site change management</p>
                                <p className="mt-0.5 text-[11px] text-ink-secondary leading-relaxed">
                                  Covered as an interview preparation drill, not an invented resume claim.
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Card Footer: States clearly this is inside ApplyLab once profile is verified */}
                  <div className="flex items-center justify-between border-t border-border pt-3.5 text-xs">
                    <span className="text-[11px] font-medium text-ink-muted">
                      Inside ApplyLab, once your profile is verified
                    </span>
                    <a href="#score">
                      <Button size="sm" className="text-xs font-bold px-3 py-1">
                        Try free score &rarr;
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
