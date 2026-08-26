"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

const PROFILE_PILLARS = [
  {
    title: "Roles & Verified Duties",
    desc: "Your complete employment history stored once, without formatting restrictions or page limits.",
    icon: "💼",
  },
  {
    title: "Quantified X-Y-Z Wins",
    desc: "Turned daily responsibilities into evidence-backed accomplishments that prove your real impact.",
    icon: "📈",
  },
  {
    title: "Portfolio & Key Projects",
    desc: "Detailed case studies, system architectures, and implementations ready to deploy into any role.",
    icon: "🚀",
  },
  {
    title: "Australian Work Rights & Contact",
    desc: "Citizen / PR / Visa status and standard 04xx mobile stored securely for 1-click portal autofill.",
    icon: "🦘",
  },
];

export function CareerProfileSection() {
  return (
    <section id="career-profile" className="scroll-mt-24 border-t border-border bg-paper-deep/60 py-20">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Pillar 2 &middot; One Verified Career Profile
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Build your profile once. Apply everywhere.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Your career history shouldn&rsquo;t live in fifteen different Word documents. ApplyLab maintains your single source of truth to power every tailored application.
            </p>
          </Reveal>
        </div>

        {/* Central Profile Hub Visual */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Feature Highlights */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {PROFILE_PILLARS.map((item, idx) => (
              <Reveal key={item.title} delay={idx * 0.06}>
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-accent/40">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{item.icon}</span>
                    <h3 className="font-display text-sm font-bold text-ink">{item.title}</h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {item.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Right Column: Visual Career Profile Hub Card */}
          <div className="lg:col-span-7">
            <Reveal delay={0.15}>
              <div className="rounded-2xl border border-border bg-surface p-6 sm:p-7 shadow-pop">
                {/* Profile Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-base font-bold text-on-accent">
                      TJ
                    </div>
                    <div>
                      <h4 className="font-display text-base font-bold text-ink">
                        Tia Julian &middot; Verified Career Profile
                      </h4>
                      <p className="text-xs text-ink-secondary">
                        Sydney, NSW &middot; Australian Citizen &middot; 0412 345 678
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success border border-success/30">
                    ✓ 100% Verified
                  </span>
                </div>

                {/* Profile Snapshot Rows */}
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg border border-border bg-paper p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">Retail Shift Supervisor &mdash; Bondi Junction</span>
                      <span className="text-ink-muted">2021 &ndash; Present</span>
                    </div>
                    <p className="mt-1 text-xs italic text-ink-secondary">
                      &ldquo;Led floor team of 14, managed customer escalations, reconciled daily registers, and overhauled stock replenishment.&rdquo;
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                        ⚡ 3 Polished X-Y-Z Wins
                      </span>
                      <span className="rounded bg-paper-deep px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                        ✓ Roster Budgeting
                      </span>
                      <span className="rounded bg-paper-deep px-2 py-0.5 text-[10px] font-medium text-ink-secondary">
                        ✓ Fair Work Compliance
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-paper p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">Hospitality Floor Lead &mdash; Surry Hills</span>
                      <span className="text-ink-muted">2019 &ndash; 2021</span>
                    </div>
                    <p className="mt-1 text-xs italic text-ink-secondary">
                      &ldquo;Coordinated supplier logistics, trained 8 casual staff members, and ensured food safety WHS compliance.&rdquo;
                    </p>
                  </div>
                </div>

                {/* Connective Hub Indicator */}
                <div className="mt-5 rounded-xl border border-accent/20 bg-accent-soft/30 p-3.5 text-center">
                  <p className="text-xs font-semibold text-accent">
                    🔗 Automatically powers: Tailored Resume &middot; Cover Letter &middot; Chrome Extension Autofill &middot; Interview Practice
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
