"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

export function ResumeWorkspaceSection() {
  const [isSupervisorsAligned, setIsSupervisorsAligned] = useState(false);
  const [isSupervisorsRemoved, setIsSupervisorsRemoved] = useState(false);

  return (
    <section id="tailored-resume" className="scroll-mt-24 bg-paper py-20 border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-center">
          {/* Left Column: Header, Lede, 3 Checkpoints */}
          <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch]">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Pillar 1 &middot; Traceable Resume Workspace
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Every line traces back to something you actually did.
              </h2>
              <p className="mt-4 text-base text-ink-secondary sm:text-lg leading-relaxed">
                Generic AI resume tools fabricate metrics and invent tools to force a keyword match. ApplyLab works strictly from your verified profile, ensuring you can defend every bullet in a live interview.
              </p>

              <div className="mt-6 flex flex-col gap-3 text-sm text-ink font-medium">
                <div className="flex items-start gap-2.5">
                  <span className="text-success font-bold mt-0.5">&#10003;</span>
                  <span>ATS-safe one-page A4 format with automated line budgeting</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-success font-bold mt-0.5">&#10003;</span>
                  <span>Fixes limited to align, remove, or add evidence &mdash; never fabricate</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-success font-bold mt-0.5">&#10003;</span>
                  <span>PDF export now, editable Word .docx export on Pro</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Product Mock B (Resume Workspace Traceability) */}
          <div className="lg:col-span-7">
            <Reveal delay={0.16}>
              <div className="rounded-lg border border-border bg-paper-deep shadow-pop overflow-hidden transition-all duration-300 hover:shadow-pop-lg">
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
                    0 invented facts &middot; 31 of 31 traced
                  </span>
                </div>

                {/* Main Workspace Preview Ground */}
                <div className="p-4 sm:p-6 space-y-4">
                  {/* Paper Document Preview at Real Measure */}
                  <div className="rounded-lg border border-border bg-surface p-5 sm:p-6 shadow-sm text-[11.5px] leading-[1.55] text-ink">
                    {/* Header */}
                    <div className="border-b border-border pb-3">
                      <h3 className="font-display text-xl font-bold tracking-tight text-ink">
                        Priya Nair
                      </h3>
                      <p className="mt-1 font-mono text-[10.5px] text-ink-secondary">
                        Cremorne VIC 3121 &middot; 0412 663 208 &middot; priya.nair@email.com &middot; Full AU work rights
                      </p>
                    </div>

                    {/* Summary */}
                    <div className="mt-3 border-b border-border pb-3">
                      <p className="font-bold uppercase tracking-wider text-[10px] text-ink-muted mb-1">
                        Professional Summary
                      </p>
                      <p className="text-ink-secondary">
                        Operations professional transitioning into Implementation Analysis, offering 5+ years optimizing workflow protocols and customer operations across Melbourne venues. Proven track record leading system rollouts and staff adoption.
                      </p>
                    </div>

                    {/* Experience */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-baseline justify-between font-semibold">
                        <span>Venue Manager &middot; Marlowe Hospitality</span>
                        <span className="font-mono text-[10.5px] text-ink-muted">2019 &ndash; 2024</span>
                      </div>

                      <ul className="space-y-2 pl-3">
                        <li className="list-disc text-ink-secondary">
                          <span className="bg-success-soft border-b-2 border-success px-1 text-ink font-medium">
                            Led system rollouts across POS and inventory platforms, reducing onboarding cycle times by 30%.
                          </span>
                        </li>

                        <AnimatePresence mode="wait">
                          {!isSupervisorsRemoved && (
                            <motion.li
                              key={isSupervisorsAligned ? "aligned" : "unaligned"}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="list-disc text-ink-secondary"
                            >
                              {isSupervisorsAligned ? (
                                <span className="bg-success-soft border-b-2 border-success px-1 text-ink font-medium transition-colors">
                                  Directly supervised 9 shift supervisors across weekend trading.
                                </span>
                              ) : (
                                <span className="bg-attention-soft border-b-2 border-attention px-1 text-ink font-medium transition-colors">
                                  Directly supervised 14 shift supervisors across weekend trading.
                                </span>
                              )}
                            </motion.li>
                          )}
                        </AnimatePresence>

                        <li className="list-disc text-ink-secondary">
                          <span className="bg-success-soft border-b-2 border-success px-1 text-ink font-medium">
                            Standardised operational workflows and trained 45+ staff members on new compliance tools.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Inline Fix Card: FactCheckFixPanel Mirror */}
                  <AnimatePresence mode="wait">
                    {!isSupervisorsAligned && !isSupervisorsRemoved ? (
                      <motion.div
                        key="fix-card"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="rounded-lg border border-attention/30 bg-attention-soft p-3.5 text-xs shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-ink">
                              ⚠️ Needs your review &middot; number doesn&rsquo;t match your profile
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink-secondary">
                              Your profile records 9 supervisors at Marlowe.
                            </p>
                          </div>
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => setIsSupervisorsAligned(true)}
                              className="flex-1 sm:flex-initial text-center rounded bg-accent hover:bg-accent-hover text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Align to profile (9)
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsSupervisorsRemoved(true)}
                              className="flex-1 sm:flex-initial text-center rounded border border-border bg-surface hover:bg-paper-deep px-3 py-1.5 text-xs font-medium text-ink transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              Remove bullet
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="success-banner"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center justify-between rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-xs shadow-sm"
                      >
                        <span className="text-success font-semibold flex items-center gap-1.5">
                          <span>✓</span>
                          <span>Resume perfectly aligned to verified career profile</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSupervisorsAligned(false);
                            setIsSupervisorsRemoved(false);
                          }}
                          className="text-[11px] text-ink-muted hover:text-ink underline transition-colors"
                        >
                          Reset demo
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

