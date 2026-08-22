"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const STEPS_DATA = [
  {
    step: "01",
    title: "Tell us what you've actually done.",
    desc: "You don't need to know how to write resume bullets. Just describe your daily work in plain language.",
    previewType: "input",
    mockText: "I handled customer complaints, balanced the till at close, and trained new staff on the floor.",
  },
  {
    step: "02",
    title: "Add the job you're applying for.",
    desc: "Paste the job ad URL or text from SEEK, LinkedIn, or the company's career page.",
    previewType: "job",
    mockText: "SEEK Listing: Operations Coordinator at Metro Logistics — Stakeholder management, Reporting, Inventory.",
  },
  {
    step: "03",
    title: "Get a resume built around the match.",
    desc: "ApplyLab connects your real experience to the requirements of the job with 100% evidence-backed translation.",
    previewType: "output",
    mockText: "• Resolved escalated customer concerns independently while performing daily financial reconciliations.",
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how-it-works" className="py-20 bg-surface border-t border-border">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Simple Workflow
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Three simple steps to a job-ready resume.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              No complex prompt engineering. No formatting hassle. Purpose-built for your job hunt.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: 3 Steps List */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {STEPS_DATA.map((item, idx) => {
              const isSelected = idx === activeStep;
              return (
                <div
                  key={item.step}
                  onClick={() => setActiveStep(idx)}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-accent bg-paper shadow-pop"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`font-display text-2xl font-bold ${
                        isSelected ? "text-accent" : "text-ink-muted"
                      }`}
                    >
                      {item.step}
                    </span>
                    <h3 className="font-display text-xl font-bold text-ink">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-xs sm:text-sm text-ink-secondary leading-relaxed pl-10">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Right Column: Visual UI Demonstration per Step */}
          <div className="lg:col-span-6 rounded-2xl border border-border bg-paper p-6 shadow-pop text-left">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">
                Step {STEPS_DATA[activeStep].step} Demonstration
              </span>
              <span className="rounded bg-paper-deep px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                Interface Preview
              </span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              {activeStep === 0 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Your Input:
                  </span>
                  <div className="mt-2 rounded-lg bg-paper p-3 text-xs italic text-ink border border-border">
                    &ldquo;{STEPS_DATA[0].mockText}&rdquo;
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-accent font-semibold">
                    <span>✓ Plain everyday English</span>
                    <span>&middot; No resume jargon needed</span>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                    Job Advertisement Detected:
                  </span>
                  <div className="mt-2 rounded-lg bg-accent-soft/40 p-3 text-xs text-ink border border-accent/20">
                    {STEPS_DATA[1].mockText}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-success font-semibold">
                    <span>✓ Instant criteria extraction</span>
                    <span>&middot; SEEK &amp; Workday compatible</span>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-success">
                    Generated Tailored Resume Bullet:
                  </span>
                  <div className="mt-2 rounded-lg bg-success-soft/30 p-3 text-xs font-semibold text-ink border border-success/20">
                    {STEPS_DATA[2].mockText}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="font-semibold text-success">✓ 100% Evidence Verified</span>
                    <span className="text-ink-muted">Strict 1-Page PDF Export</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
