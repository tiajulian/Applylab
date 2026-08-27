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
    step: "Work History & Profile",
    chatgpt: "Copy-paste your entire history into prompt threads repeatedly.",
    applylab: "Build your verified profile once, powers all applications securely.",
  },
  {
    step: "Job Matching & Truth",
    chatgpt: "Hallucinates skills, exaggerates duties, and invents tools you never used.",
    applylab: "Maps genuine evidence-backed matches and surfaces honest gaps.",
  },
  {
    step: "Form Filling & Applying",
    chatgpt: "Outputs raw text you must manually copy-paste into every field.",
    applylab: "Chrome extension autofills SEEK, Workday, LinkedIn, and PageUp in 1 click.",
  },
  {
    step: "Australian Market Fit",
    chatgpt: "Defaults to US English, corporate buzzwords, and American resume formats.",
    applylab: "100% Australian English, 04xx phone format, and strict 1-page ATS layouts.",
  },
  {
    step: "Interview Preparation",
    chatgpt: "Returns generic conversational advice without role-specific metrics.",
    applylab: "Voice + text interview simulation with turn-by-turn STAR scorecard feedback.",
  },
];

const AU_MARKET_CARDS = [
  {
    kicker: "SEEK & LinkedIn",
    title: "SEEK & LinkedIn AU",
    desc: "Optimised for Australian job ads, SEEK search terminology, and 1-click form filling.",
  },
  {
    kicker: "Enterprise Portals",
    title: "Workday, PageUp & LiveHire",
    desc: "Built to interface smoothly with Australian enterprise, university, and public sector portals.",
  },
  {
    kicker: "Localised Spelling",
    title: "100% Australian English",
    desc: "Enforces Australian spelling (e.g. organised, prioritised) and grounded professional phrasing.",
  },
  {
    kicker: "Local Standards",
    title: "Australian ATS Standards",
    desc: "Formats 04xx Australian mobile numbers, work rights, and clean scannable layouts.",
  },
];

export function ComparisonMatrixSection() {
  return (
    <section id="why-applylab" className="scroll-mt-24 bg-paper-deep/40 py-20 border-b border-border/60">
      <Container size="marketing">
        {/* Left-Aligned Header */}
        <div className="flex flex-col items-start max-w-[58ch]">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Purpose-Built Workflow
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Why not just use ChatGPT?
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg leading-relaxed">
              ChatGPT is a generalist text box. ApplyLab is a purpose-built Australian job-search copilot designed to get you hired.
            </p>
          </Reveal>
        </div>

        {/* Comparison Matrix Table (Desktop: md+) */}
        <Reveal delay={0.1}>
          <div className="mt-10 hidden md:block overflow-x-auto rounded-lg border border-border bg-surface shadow-pop">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-paper-deep/60">
                  <th className="p-4 sm:p-5 font-bold text-ink sm:w-1/4">Workflow Step</th>
                  <th className="p-4 sm:p-5 font-semibold text-ink-muted sm:w-3/8">Generic ChatGPT Workflow</th>
                  <th className="p-4 sm:p-5 font-bold text-accent bg-accent-soft/30 sm:w-3/8">
                    ApplyLab Purpose-Built Copilot 🇦🇺
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMPARISON_STEPS.map((row) => (
                  <tr key={row.step} className="transition-colors hover:bg-paper-deep/20">
                    <td className="p-4 sm:p-5 font-bold text-ink whitespace-nowrap sm:whitespace-normal">
                      {row.step}
                    </td>
                    <td className="p-4 sm:p-5 text-ink-secondary">
                      <span className="text-critical mr-1.5 font-bold">&#10005;</span> {row.chatgpt}
                    </td>
                    <td className="p-4 sm:p-5 text-ink font-medium bg-accent-soft/10">
                      <span className="text-success mr-1.5 font-bold">&#10003;</span> {row.applylab}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comparison Matrix Cards (Mobile: < md) */}
          <div className="mt-8 space-y-4 md:hidden">
            {COMPARISON_STEPS.map((row) => (
              <div key={row.step} className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-2.5">
                <h3 className="font-display text-sm font-bold text-ink border-b border-border pb-2">
                  {row.step}
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="rounded-lg bg-paper-deep/60 p-3 text-ink-secondary flex items-start gap-2.5">
                    <span className="text-critical font-bold text-xs mt-0.5 shrink-0">&#10005;</span>
                    <div>
                      <span className="font-semibold text-ink-muted block text-[10px] uppercase tracking-wider mb-0.5">Generic ChatGPT</span>
                      <span>{row.chatgpt}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-accent-soft/30 border border-accent/20 p-3 text-ink flex items-start gap-2.5">
                    <span className="text-success font-bold text-xs mt-0.5 shrink-0">&#10003;</span>
                    <div>
                      <span className="font-bold text-accent block text-[10px] uppercase tracking-wider mb-0.5">ApplyLab Copilot 🇦🇺</span>
                      <span className="font-medium">{row.applylab}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Section 9: Folded AU Market Strip (4 Cards on bg-success-soft/40) */}
        <Reveal delay={0.16}>
          <div className="mt-12 rounded-2xl border border-success/20 bg-success-soft/40 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 text-success text-xs font-bold uppercase tracking-wider mb-5">
              <span>🇦🇺</span>
              <span>The Australian Hiring Edge</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {AU_MARKET_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-border/80 bg-surface p-4 shadow-sm transition-all duration-300 hover:shadow-pop hover:-translate-y-0.5 hover:border-success/40"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-success">
                    {card.kicker}
                  </span>
                  <h3 className="mt-1 font-display text-base font-bold text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-ink-secondary leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

