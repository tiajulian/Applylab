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
    feature: "Zero AI Hallucination Guarantee (100% Traceable)",
    applylab: true,
    chatgpt: false,
    usBuilders: false,
    note: "Every line traces directly back to experience you actually gave us.",
  },
  {
    feature: "Strict 1-Page Layout Budgeting Engine",
    applylab: true,
    chatgpt: false,
    usBuilders: "partial",
    note: "Guarantees zero orphan headings or 1.2-page spillover pages.",
  },
  {
    feature: "In-Place WinBuilder & 2-Line Polish",
    applylab: true,
    chatgpt: false,
    usBuilders: false,
    note: "Turns basic duties into quantified, recruiter-grade achievements.",
  },
  {
    feature: "PDF & Editable Word (.docx) Export",
    applylab: true,
    chatgpt: "partial",
    usBuilders: true,
    note: "Export ready-to-submit PDFs and fully editable Word files.",
  },
  {
    feature: "Built-in Job Application Kanban Board",
    applylab: true,
    chatgpt: false,
    usBuilders: false,
    note: "Track Saved, Applied, Interviewing, and Offered stages in one workspace.",
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

        {/* Loss Aversion Callout Banner */}
        <Reveal delay={0.06}>
          <div className="mt-8 rounded-xl border border-attention/30 bg-attention-soft/40 p-4 text-center text-xs font-semibold text-ink">
            <span className="inline-block mr-1 text-sm">⚠️</span>
            <strong>3 out of 4 Australian resumes</strong> are rejected by SEEK and Workday ATS filters due to US formatting or missing transferable keyword mapping. ApplyLab ensures you pass on the first pass.
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
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
