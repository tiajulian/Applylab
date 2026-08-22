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
    step: "1. Setup & Profile",
    chatgpt: "Must repeatedly copy-paste your entire work history into every new chat thread.",
    applylab: "Add your work history once. ApplyLab remembers all your past experience securely.",
  },
  {
    step: "2. Job Requirement Analysis",
    chatgpt: "Requires complex prompt engineering to extract key skills from job ads manually.",
    applylab: "Paste any SEEK or Australian job ad link — ApplyLab automatically identifies key criteria.",
  },
  {
    step: "3. Skill Matching & Evidence",
    chatgpt: "Guesses connections and frequently invents duties or software tools you never used.",
    applylab: "Maps real transferable skills strictly from your evidence, flagging missing skills clearly.",
  },
  {
    step: "4. Tone & Spelling",
    chatgpt: "Defaults to US English, corporate jargon, and exaggerated buzzwords.",
    applylab: "100% Australian English with concise, grounded professional phrasing.",
  },
  {
    step: "5. Formatting & Layout",
    chatgpt: "Outputs unformatted markdown. You have to manually fix layout, spacing, and page limits.",
    applylab: "Generates a perfectly budgeted, strict 1-page PDF and editable Word document automatically.",
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
