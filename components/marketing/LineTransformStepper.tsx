"use client";

import { useState } from "react";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

interface Scenario {
  id: number;
  title: string;
  roleContext: string;
  inputRaw: string;
  outputResume: string;
  keyHighlights: string[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    title: "Retail Floor → Customer Operations Specialist",
    roleContext: "Candidate moving from retail floor into corporate operations",
    inputRaw: "Served customers at the checkout, handled returns, and did stock takes on weekends.",
    outputResume: "Coordinated front-of-house customer operations and processed high-volume transactions, conducting weekly inventory reconciliations to maintain 99.8% stock accuracy.",
    keyHighlights: ["Front-of-house operations", "High-volume transactions", "99.8% stock accuracy"],
  },
  {
    id: 2,
    title: "Hospitality Supervisor → Operations & Event Lead",
    roleContext: "Candidate leveraging hospitality leadership for office administration",
    inputRaw: "Managed floor staff during dinner shifts, booked reservations, and handled customer complaints.",
    outputResume: "Spearheaded daily service operations and led a shift team of 12, resolving escalation inquiries and managing supplier bookings to ensure seamless event delivery.",
    keyHighlights: ["Led team of 12", "Escalation management", "Supplier bookings"],
  },
  {
    id: 3,
    title: "Junior Developer → Software Engineer",
    roleContext: "Candidate aiming for senior engineering responsibilities",
    inputRaw: "Wrote SQL queries, fixed bugs in Python scripts, and helped update API endpoints.",
    outputResume: "Architected and optimised 15+ production SQL queries and Python microservices, reducing API response latency by 40% across core cloud endpoints.",
    keyHighlights: ["Optimised 15+ production SQL queries", "40% latency reduction", "Python microservices"],
  },
  {
    id: 4,
    title: "Registered Nurse → Clinical Nurse Specialist",
    roleContext: "Healthcare professional highlighting clinical coordination",
    inputRaw: "Looked after patients in the ward, administered medications, and wrote shift handover notes.",
    outputResume: "Managed comprehensive clinical care plans for 30+ daily ward admissions, administering complex medication protocols and leading interdisciplinary shift handovers under WHS standards.",
    keyHighlights: ["30+ daily admissions", "Complex medication protocols", "WHS standards"],
  },
];

export function LineTransformStepper() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const scenario = SCENARIOS.find((s) => s.id === activeStep) ?? SCENARIOS[0];

  return (
    <section id="transform" className="border-t border-border bg-paper-deep/40 py-16 sm:py-24">
      <Container size="5xl" className="flex flex-col items-center text-center">
        <Reveal>
          <span className="inline-block rounded-pill bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
            Live Career Translation
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
            Watch a line transform in real time.
          </h2>
          <p className="mt-3 text-body text-ink-secondary">
            See how ApplyLab turns everyday task descriptions into recruiter-ready achievements.
          </p>
        </Reveal>

        {/* Stepper Dots Navigation */}
        <Reveal delay={0.06}>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {SCENARIOS.map((s) => {
              const isActive = s.id === activeStep;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStep(s.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-accent text-on-accent shadow-sm scale-105"
                      : "bg-surface border border-border text-ink-secondary hover:border-accent/40 hover:text-ink"
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface/20 text-[11px] font-bold">
                    {s.id}
                  </span>
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Side-by-Side Comparison Card */}
        <Reveal delay={0.12}>
          <div className="mt-8 w-full max-w-4xl rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm text-left">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Scenario {scenario.id} of 4: {scenario.roleContext}
              </span>
              <span className="rounded bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                100% Truth Guaranteed
              </span>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {/* Left Box: What You Told Us */}
              <div className="rounded-xl border border-border bg-paper-deep/60 p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper border border-border text-xs">
                    💬
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    What you told us
                  </h4>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                  &ldquo;{scenario.inputRaw}&rdquo;
                </p>
              </div>

              {/* Right Box: On Your Resume */}
              <div className="rounded-xl border border-accent/30 bg-accent-soft/30 p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-on-accent font-bold">
                    ✨
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                    On your resume
                  </h4>
                </div>
                <p className="mt-3 text-sm leading-relaxed font-medium text-ink">
                  • {scenario.outputResume}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {scenario.keyHighlights.map((h) => (
                    <span key={h} className="rounded bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      ✓ {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
