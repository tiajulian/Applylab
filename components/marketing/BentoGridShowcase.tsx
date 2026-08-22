"use client";

import { useState } from "react";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

export function BentoGridShowcase() {
  const [winBuilderPolished, setWinBuilderPolished] = useState(false);

  return (
    <section className="py-16 sm:py-24">
      <Container size="5xl">
        <Reveal className="text-center">
          <span className="inline-block rounded-pill bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
            Engineered for Australian Hiring Systems
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
            Everything you need to beat the filters and impress recruiters.
          </h2>
          <p className="mt-3 text-body text-ink-secondary">
            Built specifically to solve the top reasons Australian candidates get filtered out.
          </p>
        </Reveal>

        {/* 3-Column Bento Grid */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Card 1: SEEK & Workday Keyword Matcher */}
          <Reveal delay={0.06}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:border-accent/30 hover:shadow-md">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-lg font-bold text-accent">
                  🎯
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">
                  SEEK & Workday Keyword Matcher
                </h3>
                <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
                  Paste any Australian job ad. We identify the exact language local recruiters and ATS filters are searching for.
                </p>
              </div>

              {/* Interactive Mini Mockup */}
              <div className="mt-6 rounded-lg border border-border bg-paper-deep/60 p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted">
                  <span>Job Ad Match Rate</span>
                  <span className="font-bold text-accent">96% Matched</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 font-medium text-accent">✓ Agile</span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 font-medium text-accent">✓ Stakeholder Mgt</span>
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 font-medium text-accent">✓ SQL</span>
                  <span className="rounded bg-paper px-1.5 py-0.5 text-ink-muted">Process Mapping</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Card 2: In-Place WinBuilder */}
          <Reveal delay={0.12}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:border-accent/30 hover:shadow-md">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-lg font-bold text-accent">
                  ⚡
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">
                  In-Place WinBuilder
                </h3>
                <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
                  Google&rsquo;s X-Y-Z formula built-in. Turns basic duties into quantified achievements with action verbs.
                </p>
              </div>

              {/* Interactive Toggle Button */}
              <div className="mt-6 rounded-lg border border-border bg-paper-deep/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-ink-muted">Bullet State</span>
                  <button
                    type="button"
                    onClick={() => setWinBuilderPolished((prev) => !prev)}
                    className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent transition-colors hover:bg-accent/90"
                  >
                    {winBuilderPolished ? "Reset" : "✨ Click to Polish"}
                  </button>
                </div>

                <p className="mt-2 leading-relaxed text-ink transition-all">
                  {winBuilderPolished ? (
                    <span className="font-medium text-accent">
                      • Engineered & optimised 20+ complex SQL queries, improving data pipeline run-time by 35%.
                    </span>
                  ) : (
                    <span className="text-ink-secondary">
                      • Wrote and optimised SQL queries for data analysis.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </Reveal>

          {/* Card 3: Strict 1-Page Layout Engine */}
          <Reveal delay={0.18}>
            <div className="flex h-full flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:border-accent/30 hover:shadow-md">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-lg font-bold text-accent">
                  📐
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">
                  Strict 1-Page Layout Engine
                </h3>
                <p className="mt-2 text-sm text-ink-secondary leading-relaxed">
                  Automatic page-budgeting. Formatted to the strict one-page standard Australian hiring managers prefer.
                </p>
              </div>

              {/* Visual Page Indicator */}
              <div className="mt-6 rounded-lg border border-border bg-paper-deep/60 p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold text-ink-muted">
                  <span>Page Budget Status</span>
                  <span className="font-bold text-accent">Exactly 1 Page (100% Fit)</span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-accent w-full transition-all" />
                </div>
                <p className="mt-1.5 text-[10px] text-ink-muted text-right">
                  0 orphan headings &middot; 0 page overflows
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
