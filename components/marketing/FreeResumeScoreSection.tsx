"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { PublicResumeScorer } from "@/components/marketing/PublicResumeScorer";

export function FreeResumeScoreSection() {
  return (
    <section id="score" className="scroll-mt-24 sec bg-paper border-b border-border/60">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center mb-10 sm:mb-12">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Free Resume Diagnostic
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Score your existing resume in 30 seconds.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Upload your PDF or Word resume to see how Australian ATS parsers read it. Inspect formatting errors, weak verbs, and missing metrics free with zero obligation.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mx-auto max-w-2xl">
            <PublicResumeScorer />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
