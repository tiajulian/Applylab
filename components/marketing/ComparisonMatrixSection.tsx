"use client";

import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

interface ComparisonRow {
  step: string;
  chatgpt: string;
  applylab: string;
}

const COMPARISON_STEPS: ComparisonRow[] = [
  {
    step: "1. Your work history",
    chatgpt: "Copy-paste your entire history into every new chat thread.",
    applylab: "Add it once. ApplyLab remembers it securely for every future resume.",
  },
  {
    step: "2. Matching to the job",
    chatgpt: "Guesses connections and frequently invents duties or tools you never used.",
    applylab: "Flags evidence-backed matches and missing skills — never invents either.",
  },
  {
    step: "3. Tone & spelling",
    chatgpt: "Defaults to US English, corporate jargon, and exaggerated buzzwords.",
    applylab: "100% Australian English with concise, grounded professional phrasing.",
  },
  {
    step: "4. Formatting & layout",
    chatgpt: "Outputs unformatted markdown you have to fix by hand.",
    applylab: "Generates a strict 1-page PDF and editable Word document automatically.",
  },
];

export function ComparisonMatrixSection() {
  return (
    <section className="py-20 bg-paper-deep/40 border-t border-border">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Purpose-Built Workflow
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Why not just use ChatGPT?
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              ChatGPT is flexible. ApplyLab is purpose-built for this workflow.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-surface shadow-pop">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-paper-deep/60">
                <th className="p-4 sm:p-5 font-bold text-ink sm:w-1/4">Workflow Step</th>
                <th className="p-4 sm:p-5 font-semibold text-ink-muted sm:w-3/8">Generic ChatGPT Workflow</th>
                <th className="p-4 sm:p-5 font-bold text-accent bg-accent-soft/30 sm:w-3/8">ApplyLab Purpose-Built Workflow 🇦🇺</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARISON_STEPS.map((row) => (
                <tr key={row.step} className="transition-colors hover:bg-paper-deep/20">
                  <td className="p-4 sm:p-5 font-bold text-ink">
                    {row.step}
                  </td>
                  <td className="p-4 sm:p-5 text-ink-secondary">
                    <span className="text-critical mr-1.5 font-bold">✕</span> {row.chatgpt}
                  </td>
                  <td className="p-4 sm:p-5 text-ink font-medium bg-accent-soft/10">
                    <span className="text-success mr-1.5 font-bold">✓</span> {row.applylab}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
