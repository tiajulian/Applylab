import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";

interface ComparisonRow {
  aspect: string;
  chatgpt: string;
  applylab: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    aspect: "Career history & profile",
    chatgpt: "Copy-paste your entire CV into prompt windows repeatedly. Starts from scratch in every new chat.",
    applylab: "Build your verified profile once. Securely powers every application with zero repeated prompting.",
  },
  {
    aspect: "Job matching & honesty",
    chatgpt: "Hallucinates skills, exaggerates responsibilities, and invents tools to force a match.",
    applylab: "Maps genuine evidence-backed matches and surfaces honest gaps with zero fabricated claims.",
  },
  {
    aspect: "Form filling & applying",
    chatgpt: "Outputs raw text blocks that you must copy-paste field by field across lengthy employer forms.",
    applylab: "Chrome extension autofills SEEK, LinkedIn, Workday, PageUp, and LiveHire in 1 click and attaches PDF.",
  },
  {
    aspect: "Australian market fit",
    chatgpt: "Defaults to US English, Silicon Valley buzzwords, and American resume formatting standards.",
    applylab: "100% Australian English (e.g. organised, prioritised), 04xx phone formatting, and strict 1-page layouts.",
  },
  {
    aspect: "Interview preparation",
    chatgpt: "Returns generic text advice without role-specific metrics or interview round simulation.",
    applylab: "Voice and text simulation with turn-by-turn STAR scorecard feedback calibrated for Australian panels.",
  },
];

export function ComparisonMatrixSection() {
  return (
    <section id="why-applylab" className="scroll-mt-24 sec-quiet band">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Why Not ChatGPT
            </span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              ChatGPT is a blank text box. ApplyLab is an Australian job-search copilot.
            </h2>
            <p className="mt-3 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Generalist AI tools cannot remember your career, cannot format for Australian ATS systems, and regularly hallucinate fake experience.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-10 overflow-hidden market-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-paper-deep/60">
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-ink w-1/4">
                      Job Search Aspect
                    </th>
                    <th className="py-3.5 px-4 sm:px-6 font-semibold text-ink-muted w-[37.5%]">
                      Generic ChatGPT
                    </th>
                    <th className="py-3.5 px-4 sm:px-6 font-bold text-accent w-[37.5%] bg-accent-soft/30">
                      ApplyLab Copilot
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.aspect} className="hover:bg-paper/40 transition-colors">
                      <td className="py-4 px-4 sm:px-6 font-bold text-ink align-top">
                        {row.aspect}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-ink-secondary align-top leading-relaxed">
                        <div className="flex items-start gap-2">
                          <XIcon className="w-4 h-4 text-attention shrink-0 mt-0.5" />
                          <span>{row.chatgpt}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-ink font-medium align-top leading-relaxed bg-accent-soft/10">
                        <div className="flex items-start gap-2">
                          <CheckIcon className="w-4 h-4 text-success shrink-0 mt-0.5" />
                          <span>{row.applylab}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
