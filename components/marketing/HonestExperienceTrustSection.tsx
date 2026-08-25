"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const TRUST_COMMITMENTS = [
  {
    title: "Every claim traces to something you told us",
    desc: "Employers, qualifications, duties, and tools all come from your real history — the same evidence chain you clicked through above.",
  },
  {
    title: "Gaps get flagged, not filled",
    desc: "If a job asks for a tool or metric you haven't got, ApplyLab names the gap instead of inventing one.",
  },
  {
    title: "Defensible in every interview",
    desc: "Because nothing is invented, you can speak to every line on your resume with confidence.",
  },
];

export function HonestExperienceTrustSection() {
  return (
    <section className="py-16 bg-paper-deep/60 border-y border-border/60">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Truth &amp; Integrity Guarantee
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Your resume should never tell a story you didn&rsquo;t live.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Generic AI tools invent achievements to match keywords. ApplyLab works strictly from the evidence you provide.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TRUST_COMMITMENTS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <span>✓</span>
                <span>{item.title}</span>
              </div>
              <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
