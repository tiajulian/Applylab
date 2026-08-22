"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

interface ComparisonRow {
  feature: string;
  applylab: boolean | string;
  chatgpt: boolean | string;
  usBuilders: boolean | string;
  note: string;
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    feature: "100% Australian English by Default",
    applylab: true,
    chatgpt: false,
    usBuilders: false,
    note: "Enforces AU spelling (optimised, prioritised) & local workplace terms.",
  },
  {
    feature: "SEEK & Workday ATS Keyword Matcher",
    applylab: true,
    chatgpt: false,
    usBuilders: "partial",
    note: "Tailored specifically for Australia's top hiring portals.",
  },
  {
    feature: "100% Truth Guarantee (No Fake AI Claims)",
    applylab: true,
    chatgpt: false,
    usBuilders: false,
    note: "Every line traces directly back to experience you actually gave us.",
  },
  {
    feature: "Automatic 1-Page Layout Budgeting",
    applylab: true,
    chatgpt: false,
    usBuilders: "partial",
    note: "Guarantees zero orphan headings or single-line spillover pages.",
  },
  {
    feature: "Google X-Y-Z Achievement Builder",
    applylab: true,
    chatgpt: false,
    usBuilders: false,
    note: "Turns basic duties into quantified, recruiter-grade achievements.",
  },
];

function RenderStatus({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent shadow-sm">
        ✓
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-paper-deep border border-border text-xs font-bold text-ink-muted">
        ⚠️
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-critical-soft text-xs font-bold text-critical">
      ✕
    </span>
  );
}

export function ComparisonMatrixSection() {
  return (
    <section className="py-16 sm:py-24 border-t border-border bg-surface">
      <Container size="5xl">
        <Reveal className="text-center">
          <span className="inline-block rounded-pill bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
            The ApplyLab Advantage
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
            Why Australian job seekers choose ApplyLab.
          </h2>
          <p className="mt-3 text-body text-ink-secondary">
            Generic AI tools generate fluff. US builders don&rsquo;t understand Australian hiring. Here&rsquo;s how we compare.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-paper-deep/60">
                  <th className="p-4 font-semibold text-ink sm:w-2/5">Feature / Capability</th>
                  <th className="p-4 font-bold text-accent text-center bg-accent-soft/30 sm:w-1/5">
                    ApplyLab 🇦🇺
                  </th>
                  <th className="p-4 font-semibold text-ink-secondary text-center sm:w-1/5">ChatGPT</th>
                  <th className="p-4 font-semibold text-ink-secondary text-center sm:w-1/5">US Builders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON_DATA.map((row) => (
                  <tr key={row.feature} className="transition-colors hover:bg-paper-deep/30">
                    <td className="p-4 font-medium text-ink">
                      <div>{row.feature}</div>
                      <div className="text-xs text-ink-muted mt-0.5">{row.note}</div>
                    </td>
                    <td className="p-4 text-center bg-accent-soft/10">
                      <RenderStatus value={row.applylab} />
                    </td>
                    <td className="p-4 text-center">
                      <RenderStatus value={row.chatgpt} />
                    </td>
                    <td className="p-4 text-center">
                      <RenderStatus value={row.usBuilders} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
