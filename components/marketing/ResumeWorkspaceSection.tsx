"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon, AlertTriangleIcon } from "@/components/ui/icons/LucideIcons";
import { PROOF_FIGURES } from "@/lib/marketingProofData";

export function ResumeWorkspaceSection() {
  const reduceMotion = useReducedMotion();
  const [isSupervisorsAligned, setIsSupervisorsAligned] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Motion 3: Self-running loop: 3.4s flagged, 4.8s resolved, then resets
  useEffect(() => {
    if (reduceMotion) {
      setIsSupervisorsAligned(true);
      return;
    }

    let isSubscribed = true;

    function runLoop(aligned: boolean) {
      if (!isSubscribed) return;
      setIsSupervisorsAligned(aligned);
      const delay = aligned ? 4800 : 3400;

      timeoutRef.current = setTimeout(() => {
        runLoop(!aligned);
      }, delay);
    }

    runLoop(false);

    return () => {
      isSubscribed = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reduceMotion]);

  return (
    <section id="tailored-resume" className="scroll-mt-24 sec bg-paper border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
          {/* Left Column: Emotional Core Header & Proof Points */}
          <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch]">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                The Traceable Resume
              </span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-[47px] font-bold tracking-tight text-ink leading-[1.08]">
                Every single line traces to something you actually did.
              </h2>
              <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed">
                The biggest fear in job hunting is getting caught out in an interview on a claim you cannot defend. Generic AI tools invent metrics to trick keyword filters. ApplyLab keeps your claims strictly tethered to your verified evidence chain.
              </p>

              <div className="mt-6 flex flex-col gap-3 text-sm text-ink font-medium">
                <div className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span>Strict 1-page Australian ATS layout with automatic line budgeting</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span>Fixes limited to align, remove, or add verified evidence, never fabricate</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  <span>Zero hallucinations: walk into panel interviews completely confident</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Product Mock B (Traceability in Action) */}
          <div className="lg:col-span-7">
            <Reveal delay={0.16}>
              <div className="market-card overflow-hidden bg-paper-deep shadow-pop">
                {/* Fake Browser Bar */}
                <div className="flex items-center justify-between border-b border-border bg-surface/80 px-4 py-2.5 backdrop-blur-sm text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                    <span className="h-2.5 w-2.5 rounded-full bg-border" />
                  </div>
                  <span className="font-mono text-[11px] text-ink-muted truncate max-w-[130px] sm:max-w-none">
                    applylab.au/resume/priya-nair-rosterly
                  </span>
                  <span className="font-semibold text-[10.5px] sm:text-[11px] text-success shrink-0">
                    {PROOF_FIGURES.factsTraced}
                  </span>
                </div>

                {/* Main Workspace Preview */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Paper Document Preview */}
                  <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 text-[11.5px] leading-[1.55] text-ink">
                    {/* Header */}
                    <div className="border-b border-border pb-3">
                      <h3 className="font-display text-xl font-bold tracking-tight text-ink">
                        Priya Nair
                      </h3>
                      <p className="mt-1 font-mono text-[10.5px] text-ink-secondary">
                        Cremorne VIC 3121 &middot; 0412 663 208 &middot; priya.nair@email.com &middot; Full AU work rights
                      </p>
                    </div>

                    {/* Professional Summary */}
                    <div className="mt-3 border-b border-border pb-3">
                      <p className="font-bold uppercase tracking-wider text-[10px] text-ink-muted mb-1">
                        Professional Summary
                      </p>
                      <p className="text-ink-secondary">
                        Operations professional transitioning into Implementation Analysis, offering 5+ years optimising workflow protocols and customer operations across Melbourne venues. Proven track record leading system rollouts and staff adoption.
                      </p>
                    </div>

                    {/* Experience */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-baseline justify-between font-semibold">
                        <span>Venue Manager &middot; Marlowe Hospitality</span>
                        <span className="font-mono text-[10.5px] text-ink-muted">2019 : 2024</span>
                      </div>

                      <ul className="space-y-2 pl-3">
                        <li className="list-disc text-ink-secondary">
                          <span className="bg-success-soft border-b-2 border-success px-1 text-ink font-medium">
                            Led system rollouts across POS and inventory platforms, reducing onboarding cycle times by 30%.
                          </span>
                        </li>

                        {/* Animated Flag / Alignment Line */}
                        <li className="list-disc text-ink-secondary">
                          <AnimatePresence mode="wait">
                            {isSupervisorsAligned ? (
                              <motion.span
                                key="aligned"
                                initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={reduceMotion ? undefined : { opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="inline-block bg-success-soft border-b-2 border-success px-1 text-ink font-medium transition-colors"
                              >
                                Directly supervised 9 shift supervisors across weekend trading.
                              </motion.span>
                            ) : (
                              <motion.span
                                key="flagged"
                                initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={reduceMotion ? undefined : { opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="relative inline-block bg-attention-soft border-b-2 border-attention px-1 text-ink font-medium ring-2 ring-attention/50 rounded-sm"
                              >
                                Directly supervised 14 shift supervisors across weekend trading.
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </li>

                        <li className="list-disc text-ink-secondary">
                          <span className="bg-success-soft border-b-2 border-success px-1 text-ink font-medium">
                            Standardised operational workflows and trained 45+ staff members on new compliance tools.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Dynamic Review / Confirmation Banner (Loops between warning and resolved confirmation) */}
                  <div className="min-h-[52px]">
                    <AnimatePresence mode="wait">
                      {!isSupervisorsAligned ? (
                        <motion.div
                          key="fix-card"
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="rounded-lg border border-attention/30 bg-attention-soft p-3 text-xs shadow-sm flex items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangleIcon className="w-4 h-4 text-attention mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold text-ink">
                                Discrepancy caught: number does not match your profile
                              </p>
                              <p className="mt-0.5 text-[11px] text-ink-secondary">
                                Profile says 9 supervisors at Marlowe, drafted line claimed 14.
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded bg-accent px-2.5 py-1 text-[10px] font-bold text-on-accent">
                            Auto-Aligning...
                          </span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="success-banner"
                          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-between rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-xs shadow-sm"
                        >
                          <span className="text-success font-semibold flex items-center gap-1.5">
                            <CheckIcon className="w-4 h-4 text-success" />
                            <span>Resume aligned to verified profile (9 supervisors). Fully defensible.</span>
                          </span>
                          <span className="text-[10px] font-bold text-success uppercase">
                            Verified ✓
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
