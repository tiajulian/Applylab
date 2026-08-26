"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

const TRIO_CARDS = [
  {
    kicker: "Cover Letters",
    title: "One click from the tailored resume.",
    desc: "Grounded in the same verified evidence chain, matched to company tone and role requirements without corporate fluff.",
    badge: "Tone · Grounded AU English",
    badgeType: "accent",
  },
  {
    kicker: "AI Interview Coach",
    title: "Voice or text, scored on STAR.",
    desc: "Practice role-specific behavioural and technical questions with real-time scoring on Situation, Task, Action, and Result.",
    badge: "STAR Scorecard · 92/100",
    badgeType: "success",
  },
  {
    kicker: "Application Tracker",
    title: "Applied → interviewing → offer.",
    desc: "A connected Kanban board that keeps job ads, tailored resumes, notes, and interview prep in one place.",
    badge: "Kanban · Live sync",
    badgeType: "neutral",
  },
];

export function CompactTrioSection() {
  return (
    <section className="bg-paper py-20 border-b border-border/60">
      <Container size="marketing">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRIO_CARDS.map((card, idx) => (
            <Reveal key={card.title} delay={idx * 0.08}>
              <div className="group h-full rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-pop-lg hover:border-accent/40">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                      {card.kicker}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      card.badgeType === "success"
                        ? "bg-success-soft text-success border border-success/30"
                        : card.badgeType === "accent"
                        ? "bg-accent-soft text-accent border border-accent/30"
                        : "bg-paper-deep text-ink-secondary border border-border"
                    }`}>
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold text-ink group-hover:text-accent transition-colors">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
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

