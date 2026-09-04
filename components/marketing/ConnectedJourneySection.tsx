import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

const CORE_STEPS = [
  {
    step: "1",
    title: "Build your verified profile",
    tag: "Single source of truth",
    desc: "Add your career history, confirmed duties, tools, and quantified wins once. This permanent record powers every single application without repeated prompting.",
  },
  {
    step: "2",
    title: "Match and tailor to the role",
    tag: "100% Defensible",
    desc: "Paste any Australian job ad from SEEK or LinkedIn. ApplyLab maps verified evidence, flags honest skill gaps, and generates a strict 1-page ATS resume.",
  },
  {
    step: "3",
    title: "Apply and walk in prepared",
    tag: "Full Copilot",
    desc: "Autofill enterprise application portals in seconds with our Chrome extension, log the role to your Kanban board, and drill realistic interview questions.",
  },
];

const SECONDARY_TOOLS = [
  {
    title: "Chrome Extension Autofill",
    desc: "Fills Australian phone numbers, addresses, and work rights in 1 click across SEEK, Workday, PageUp, and LiveHire.",
  },
  {
    title: "Voice AI Interview Coach",
    desc: "Simulates realistic Australian phone screen, panel, and behavioral rounds with turn-by-turn STAR scorecard feedback.",
  },
  {
    title: "Application Command Centre",
    desc: "Drag-and-drop Kanban tracker automatically captures application dates, job titles, companies, and salary bands.",
  },
];

export function ConnectedJourneySection() {
  return (
    <section id="how" className="sec band">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              How It Works
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Three steps to a job application you can defend.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              No endless re-prompting, no fabricated achievements, and no copy-paste marathons across employer job portals.
            </p>
          </Reveal>
        </div>

        {/* Primary Row: Three Core Steps */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {CORE_STEPS.map((item, idx) => (
            <Reveal key={item.step} delay={idx * 0.08}>
              <div className="market-card p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-paper font-display text-sm font-bold">
                      {item.step}
                    </span>
                    <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-ink-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Secondary Row: Connected Toolset */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/80 pt-6">
          {SECONDARY_TOOLS.map((tool, idx) => (
            <Reveal key={tool.title} delay={0.24 + idx * 0.06}>
              <div className="rounded-lg border border-border/60 bg-surface/60 p-4 text-left">
                <h4 className="text-xs font-bold text-ink">
                  {tool.title}
                </h4>
                <p className="mt-1 text-[11px] text-ink-muted leading-relaxed">
                  {tool.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
