"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";

const TRUST_COMMITMENTS = [
  {
    title: "Every claim traces to something you told us",
    desc: "Employers, qualifications, duties, and tools all come from your real verified profile, no fabricated metrics or fake past roles.",
  },
  {
    title: "Gaps get flagged honestly, not filled",
    desc: "If a job asks for a tool or metric you haven't got, ApplyLab highlights the gap and coaches you how to address it in interviews.",
  },
  {
    title: "100% defensible in every interview",
    desc: "Because nothing is invented, you can walk into any Australian panel interview confident you can back up every single word.",
  },
];

export function HonestExperienceTrustSection() {
  return (
    <section className="bg-ink text-paper py-20 border-y border-white/10">
      <Container size="marketing">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Header */}
          <div className="lg:col-span-5 flex flex-col items-start max-w-[58ch]">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Truth &amp; Integrity Guarantee
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-paper sm:text-4xl">
                Your application should never tell a story you didn&rsquo;t live.
              </h2>
              <p className="mt-4 text-base text-paper/80 sm:text-lg leading-relaxed">
                Generic AI tools invent achievements to game keyword filters. ApplyLab works strictly from your verified evidence chain so you can speak to every claim with confidence in any Australian panel interview.
              </p>
            </Reveal>
          </div>

          {/* Right Column: 3 Stacked Cards */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {TRUST_COMMITMENTS.map((item, idx) => (
              <Reveal key={item.title} delay={idx * 0.08}>
                <div className="group rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-0.5">
                  <div className="flex items-center gap-2 text-accent font-bold text-sm sm:text-base group-hover:text-accent-hover transition-colors">
                    <span className="text-accent">&#10003;</span>
                    <span className="text-paper">{item.title}</span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-paper/70 leading-relaxed pl-5">
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
