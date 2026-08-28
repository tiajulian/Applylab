"use client";

import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const JOURNEY_STEPS = [
  {
    step: "1",
    title: "Verify your history",
    desc: "Build your verified career profile once. Your roles, duties, and wins become your permanent source of truth.",
  },
  {
    step: "2",
    title: "Paste the ad",
    desc: "Paste any SEEK, LinkedIn, or portal ad to instantly see matched must-haves, transferable skills, and honest gaps.",
  },
  {
    step: "3",
    title: "Tailor the resume",
    desc: "Generate a strict 1-page ATS-safe resume where every bullet traces back to your verified profile.",
  },
  {
    step: "4",
    title: "Autofill the form",
    desc: "Our Chrome extension fills SEEK, Workday, and PageUp in one click with your AU phone, address, and rights.",
  },
  {
    step: "5",
    title: "Rehearse out loud",
    desc: "Simulate realistic voice or text interview rounds with turn-by-turn STAR scorecard feedback.",
  },
  {
    step: "6",
    title: "Track to offer",
    desc: "Manage every role on a connected Kanban command centre from first click to signed contract.",
  },
];

export function ConnectedJourneySection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-paper-deep/40 py-20 border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
          {/* Left Column: Header & Outline CTA */}
          <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch]">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                The Complete Copilot Journey
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                One copilot from job ad to job offer.
              </h2>
              <p className="mt-4 text-base text-ink-secondary sm:text-lg leading-relaxed">
                Stop juggling five disconnected tools. Build your verified career profile once, and let ApplyLab power every stage of your Australian job search.
              </p>
              <div className="mt-8">
                <Link href="/onboarding">
                  <Button variant="outline" size="md" className="rounded-pill px-6 font-semibold">
                    Start for free &rarr;
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Right Column: 2x3 Grid of Numbered Steps */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {JOURNEY_STEPS.map((item, idx) => (
              <Reveal key={item.step} delay={idx * 0.05}>
                <div className="h-full rounded-xl border border-border bg-surface p-5 shadow-sm transition-all hover:shadow-pop hover:border-accent/30">
                  <div className="flex items-center gap-3">
                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
                      {item.step}
                    </span>
                    <h3 className="font-display text-base font-bold text-ink">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                    {item.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
