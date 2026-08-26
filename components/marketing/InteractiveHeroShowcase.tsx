"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import { ProgressBar } from "@/components/ui/ProgressBar";

const PILLAR_PILLS = [
  { label: "Match", icon: "🎯", href: "#job-matcher" },
  { label: "Profile", icon: "📁", href: "#career-profile" },
  { label: "Resume", icon: "📄", href: "#tailored-resume" },
  { label: "Cover Letter", icon: "✉️", href: "#cover-letter" },
  { label: "Apply", icon: "⚡", href: "#extension-copilot" },
  { label: "Interview", icon: "🎙️", href: "#interview-coach" },
  { label: "Track", icon: "📊", href: "#application-tracker" },
];

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
              From job ad to job offer. Your AI job-search copilot, built for Australia.
            </h1>
          </Reveal>

          <Reveal delay={0.14}>
            <p className="mt-5 text-lg text-ink-secondary sm:text-xl leading-relaxed">
              Find roles worth applying to, understand your match, tailor your resume and cover letter, autofill applications on SEEK &amp; Workday, and walk into interviews prepared, all powered by one verified career profile.
            </p>
          </Reveal>

          {/* Connected Pillar Quick-Pills */}
          <Reveal delay={0.18}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {PILLAR_PILLS.map((pill) => (
                <a
                  key={pill.label}
                  href={pill.href}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-ink-secondary transition-all hover:border-accent hover:text-ink hover:shadow-sm"
                >
                  <span>{pill.icon}</span>
                  <span>{pill.label}</span>
                </a>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="shadow-md transition-transform hover:-translate-y-0.5 px-7 py-3 text-base">
                  Start for free &rarr;
                </Button>
              </Link>
              <a
                href="#how-it-works"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:text-ink min-h-[44px] px-4 py-2 rounded-full border border-border bg-surface hover:bg-paper-deep"
              >
                See how it works
                <span className="transition-transform group-hover:translate-y-0.5">&darr;</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.28}>
            <p className="mt-4 text-xs font-medium text-ink-muted">
              2 applications free &middot; No credit card required &middot; 100% Australian English
            </p>
          </Reveal>
        </div>

        {/* Hero Interactive Job-Match Card Visual */}
        <div className="mt-12 mx-auto max-w-xl">
          <Reveal delay={0.32}>
            <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-pop transition-all hover:shadow-lg">
              {/* Job Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                    🎯 Target Role Match
                  </span>
                  <h3 className="font-display text-lg font-bold text-ink sm:text-xl">
                    Operations Coordinator
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Metro Logistics &amp; Services &middot; Sydney NSW (Hybrid) &middot; SEEK
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success border border-success/30">
                  83% Fit
                </span>
              </div>

              {/* Progress & Breakdown */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">
                    You match <CountUp value={5} className="font-bold tabular-nums" /> of 6 must-haves
                  </span>
                  <span className="text-ink-muted text-[11px]">83% Match</span>
                </div>
                <ProgressBar value={83} className="mt-2" />
              </div>

              {/* Matched Requirement Sample */}
              <div className="mt-3.5 rounded-lg border border-success/25 bg-success-soft/50 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-success font-bold">&#10003;</span>
                  <div className="text-xs">
                    <p className="font-semibold text-ink">
                      Stakeholder Management &amp; Customer Escalations
                    </p>
                    <p className="mt-0.5 text-ink-secondary">
                      Grounded in Retail Shift Supervisor history: <span className="italic">&ldquo;Handled complaints on floor and coordinated staff.&rdquo;</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Honest Gap Notice */}
              <div className="mt-2 rounded-lg border border-border bg-paper-deep/80 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink">
                    ⚠️ Honest Gap: Power BI Reporting
                  </span>
                  <span className="text-[10px] font-bold uppercase text-ink-muted">
                    Not in profile
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-secondary">
                  ApplyLab leaves it off rather than inventing fake experience.
                </p>
              </div>

              {/* Bottom Card Action */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-ink-muted font-medium">
                  One profile powers every step
                </span>
                <a
                  href="#job-matcher"
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                >
                  Test the Job Matcher &rarr;
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}


