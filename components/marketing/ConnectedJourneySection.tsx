"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

const JOURNEY_STEPS = [
  {
    step: "01",
    label: "Match",
    title: "Job-Ad Matcher",
    desc: "Paste any Australian job ad to see your true match score, transferable skills, and honest gaps before applying.",
    icon: "🎯",
    href: "#job-matcher",
    badge: "SEEK & LinkedIn",
  },
  {
    step: "02",
    label: "Profile",
    title: "One Career Profile",
    desc: "Your verified work history, quantified achievements, and projects in one place. Build it once, power every application.",
    icon: "📁",
    href: "#career-profile",
    badge: "Single Source of Truth",
  },
  {
    step: "03",
    label: "Tailor",
    title: "Resume & Cover Letter",
    desc: "Generate role-specific resumes and cover letters with strict ATS keyword scoring, X-Y-Z polish, and zero hallucinations.",
    icon: "📄",
    href: "#tailored-resume",
    badge: "100% Truth Guaranteed",
  },
  {
    step: "04",
    label: "Apply",
    title: "Extension Co-Pilot",
    desc: "1-click autofill on SEEK, Workday, LinkedIn, and PageUp. Attach resumes and answer employer screening questions in seconds.",
    icon: "⚡",
    href: "#extension-copilot",
    badge: "Chrome Extension",
  },
  {
    step: "05",
    label: "Prepare",
    title: "AI Interview Coach",
    desc: "Practice role-tailored phone screens, technical rounds, and behavioural interviews with turn-by-turn STAR scorecard feedback.",
    icon: "🎙️",
    href: "#interview-coach",
    badge: "Voice & Text",
  },
  {
    step: "06",
    label: "Track",
    title: "Application Hub",
    desc: "Manage every role on your Kanban command centre — connecting job ads, resumes, notes, and interview prep in one place.",
    icon: "📊",
    href: "#application-tracker",
    badge: "Kanban Board",
  },
];

export function ConnectedJourneySection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 border-t border-border bg-paper-deep/50 py-20">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              The Complete Copilot Journey
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              One copilot from job ad to job offer.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Stop juggling five disconnected tools. Build your verified career profile once, and let ApplyLab power every stage of your Australian job search.
            </p>
          </Reveal>
        </div>

        {/* 6-Step Journey Grid */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY_STEPS.map((item, idx) => (
            <Reveal key={item.step} delay={idx * 0.05}>
              <a
                href={item.href}
                className="group flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-accent/40 hover:shadow-pop"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-base">
                        {item.icon}
                      </span>
                      <span className="font-display text-xs font-bold text-accent">
                        STEP {item.step}
                      </span>
                    </div>
                    <span className="rounded bg-paper-deep px-2 py-0.5 text-[10px] font-semibold text-ink-muted group-hover:bg-accent-soft group-hover:text-accent transition-colors">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-lg font-bold text-ink group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-accent opacity-90 group-hover:opacity-100">
                  <span>Explore {item.label}</span>
                  <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        {/* Trust Spine Banner */}
        <div className="mt-10 mx-auto max-w-2xl rounded-xl border border-border bg-surface p-4 text-center shadow-sm">
          <p className="text-xs text-ink font-medium">
            🔒 <span className="font-semibold">The ApplyLab Integrity Rule:</span> Every bullet, cover letter, and interview prompt is grounded in your verified career history. We never invent your experience.
          </p>
        </div>
      </Container>
    </section>
  );
}
