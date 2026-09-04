"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { AutofillVideoShowcase } from "@/components/landing/AutofillVideoShowcase";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

const SUPPORTED_PORTALS = ["SEEK", "LinkedIn AU", "Workday", "PageUp", "LiveHire"];

const FEATURE_TRIO = [
  {
    kicker: "Cover Letters",
    title: "One click from your tailored resume.",
    desc: "Grounded in the exact same verified evidence chain. Matches company tone and job requirements without robotic filler or fake claims.",
    badge: "Grounded AU English",
    badgeValue: "",
  },
  {
    kicker: "AI Interview Coach",
    title: "Voice or text, scored live on STAR.",
    desc: "Practice role-specific behavioural and technical interview questions with turn-by-turn STAR scorecard feedback on Situation, Task, Action, and Result.",
    badge: "STAR Scorecard",
    badgeValue: "92/100",
  },
  {
    kicker: "Application Tracker",
    title: "Applied, interviewing, offer.",
    desc: "A connected Kanban board that keeps job ads, tailored resumes, recruiter notes, and interview prep organized in one single workspace.",
    badge: "Auto-sync from extension",
    badgeValue: "",
  },
];

export function ExtensionAndFeaturesSection() {
  return (
    <section id="extension" className="sec bg-paper border-b border-border/60">
      <Container size="marketing">
        {/* Section Header with deliberate "And it also does this" kicker */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              And It Also Does This
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Autofill the forms, nail the interview, and track to offer.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Once your profile is verified, ApplyLab handles the repetitive application chores and prepares you for Australian panel interviews.
            </p>
          </Reveal>
        </div>

        {/* Chrome Extension Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Interactive Autofill Showcase */}
          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <AutofillVideoShowcase />
            </Reveal>
          </div>

          {/* Right Column: Extension Explanation & Supported Portals */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <Reveal delay={0.16}>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Chrome Extension Co-Pilot
              </span>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Skip the copy-paste marathon on Workday and SEEK.
              </h3>
              <p className="mt-4 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                Applying for jobs in Australia usually means retyping your work history twenty times. The ApplyLab Chrome extension detects application forms, fills standard Australian mobile numbers and work rights, and attaches your tailored PDF resume in 1 click.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 text-xs text-ink font-medium">
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-success shrink-0" />
                  <span>04xx mobile number and AU residency formatting</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-success shrink-0" />
                  <span>Direct binary PDF injection without drag-and-drop</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-success shrink-0" />
                  <span>Auto-logs company, salary, and job ad to your Kanban board</span>
                </div>
              </div>

              {/* Supported Portals */}
              <div className="mt-8 border-t border-border pt-4 w-full">
                <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2.5">
                  Supported Australian Portals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORTED_PORTALS.map((portal) => (
                    <span
                      key={portal}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-secondary"
                    >
                      {portal}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Feature Trio Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURE_TRIO.map((card, idx) => (
            <Reveal key={card.title} delay={0.2 + idx * 0.08}>
              <div className="market-card p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      {card.kicker}
                    </span>
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {card.badge}
                      {card.badgeValue && (
                        <>
                          {" "}&middot; <span className="font-mono">{card.badgeValue}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    {card.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
