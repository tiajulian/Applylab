"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

interface KanbanCardItem {
  role: string;
  company: string;
  location: string;
  match: string;
  source: string;
  appliedDate?: string;
  stage?: string;
  prepDone?: boolean;
  offerDetails?: string;
}

interface KanbanColumnItem {
  id: string;
  title: string;
  count: number;
  cards: KanbanCardItem[];
}

const KANBAN_COLUMNS: KanbanColumnItem[] = [
  {
    id: "saved",
    title: "Saved",
    count: 2,
    cards: [
      {
        role: "Store Operations Lead",
        company: "Woolworths Group",
        location: "Sydney NSW",
        match: "88% Fit",
        source: "SEEK",
      },
    ],
  },
  {
    id: "applied",
    title: "Applied",
    count: 3,
    cards: [
      {
        role: "Product Operations Specialist",
        company: "Atlassian",
        location: "Sydney NSW (Hybrid)",
        match: "84% Fit",
        source: "Workday",
        appliedDate: "Applied 2 days ago via Extension",
      },
    ],
  },
  {
    id: "interviewing",
    title: "Interviewing",
    count: 2,
    cards: [
      {
        role: "Operations Coordinator",
        company: "Metro Logistics",
        location: "Sydney NSW",
        match: "83% Fit",
        source: "SEEK",
        stage: "Panel Interview Scheduled",
        prepDone: true,
      },
    ],
  },
  {
    id: "offer",
    title: "Offer",
    count: 1,
    cards: [
      {
        role: "Customer Operations Lead",
        company: "Canva",
        location: "Surry Hills NSW",
        match: "91% Fit",
        source: "LinkedIn",
        offerDetails: "Offer Received &middot; $92,000 AUD",
      },
    ],
  },
];

export function TrackerSection() {
  return (
    <section id="application-tracker" className="scroll-mt-24 py-20 bg-surface border-t border-border">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Pillar 7 &middot; Application Command Centre
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              One place for every application, from applied to offer.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Never wonder which resume version you sent or scramble to recall what was in the job ad. ApplyLab organizes every application, tailored asset, and interview note on a single interactive board.
            </p>
          </Reveal>
        </div>

        {/* Kanban Board Preview */}
        <div className="mt-12 overflow-x-auto pb-4">
          <div className="grid min-w-[760px] grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((col) => (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl border border-border bg-paper p-4 shadow-sm"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="font-display text-sm font-bold text-ink">{col.title}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-paper-deep text-[11px] font-bold text-ink-muted">
                    {col.count}
                  </span>
                </div>

                {/* Cards */}
                <div className="mt-3 flex flex-col gap-3">
                  {col.cards.map((card) => (
                    <div
                      key={card.company}
                      className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-accent/40 hover:shadow-pop"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-display text-xs sm:text-sm font-bold text-ink leading-tight">
                          {card.role}
                        </h4>
                        <span className="shrink-0 rounded bg-success-soft px-1.5 py-0.5 text-[9px] font-bold text-success">
                          {card.match}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-secondary">
                        {card.company} &middot; {card.location}
                      </p>

                      {card.appliedDate && (
                        <p className="mt-2 text-[10px] text-accent font-semibold">
                          ⚡ {card.appliedDate}
                        </p>
                      )}

                      {card.stage && (
                        <div className="mt-2.5 rounded bg-accent-soft/40 p-1.5 text-[10px] font-bold text-accent">
                          🎙️ {card.stage}
                        </div>
                      )}

                      {card.offerDetails && (
                        <div className="mt-2.5 rounded bg-success-soft/50 p-1.5 text-[10px] font-bold text-success border border-success/30">
                          🎉 {card.offerDetails}
                        </div>
                      )}

                      {/* Linked Assets Badges */}
                      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2 text-[10px] text-ink-muted">
                        <span className="rounded bg-paper px-1.5 py-0.5 font-medium">📄 Resume</span>
                        <span className="rounded bg-paper px-1.5 py-0.5 font-medium">✉️ Cover Letter</span>
                        {card.prepDone && (
                          <span className="rounded bg-success-soft px-1.5 py-0.5 font-bold text-success">
                            ✓ Prepped
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
