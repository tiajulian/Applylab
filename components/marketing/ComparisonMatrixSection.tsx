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
    step: "1. Work History & Profile",
    chatgpt: "Copy-paste your entire history into every prompt thread repeatedly.",
    applylab: "Build your verified profile once. ApplyLab securely powers all applications from one place.",
  },
  {
    step: "2. Job Matching & Truth",
    chatgpt: "Hallucinates skills, exaggerates responsibilities, and invents tools you never used.",
    applylab: "Maps genuine evidence-backed matches and surfaces honest gaps with zero hallucination.",
  },
  {
    step: "3. Form Filling & Applying",
    chatgpt: "Outputs raw text you must manually copy-paste into every single employer field.",
    applylab: "1-Click Chrome extension autofills SEEK, LinkedIn, Workday & PageUp, attaching tailored PDFs.",
  },
  {
    step: "4. Australian Market Fit",
    chatgpt: "Defaults to US English, corporate buzzwords, and American resume standards.",
    applylab: "100% Australian English (e.g. organised, prioritised), AU phone format (04xx), and strict 1-page layouts.",
  },
  {
    step: "5. Interview Preparation",
    chatgpt: "Returns generic conversational advice without role-specific scoring or feedback.",
    applylab: "Voice + text interview simulation with turn-by-turn STAR scorecard metrics and gap coaching.",
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
              ChatGPT is a generalist text box. ApplyLab is a purpose-built Australian job-search copilot designed to get you hired.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-surface shadow-pop">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-paper-deep/60">
                <th className="p-4 sm:p-5 font-bold text-ink sm:w-1/4">Workflow Step</th>
                <th className="p-4 sm:p-5 font-semibold text-ink-muted sm:w-3/8">Generic ChatGPT Workflow</th>
                <th className="p-4 sm:p-5 font-bold text-accent bg-accent-soft/30 sm:w-3/8">ApplyLab Purpose-Built Copilot 🇦🇺</th>
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

