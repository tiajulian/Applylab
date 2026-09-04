import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

const AU_PILLARS = [
  {
    title: "100% Australian English",
    badge: "Localised Spelling",
    desc: "Enforces genuine Australian spelling such as organised, prioritised, and behaviour. Zero Americanisms or generic Silicon Valley corporate buzzwords.",
  },
  {
    title: "Australian ATS Standards",
    badge: "04xx & 1-Page Layout",
    desc: "Formatted strictly for Australian recruiter expectations: standard 04xx xxx xxx phone layouts, Australian work rights, and clean text without profile photos.",
  },
  {
    title: "Built for SEEK & Local Portals",
    badge: "SEEK, PageUp, Workday",
    desc: "Engineered specifically around SEEK search terminology and the exact enterprise ATS systems used by ASX 200, university, and government employers.",
  },
  {
    title: "Interview Defensibility",
    badge: "Panel-Ready",
    desc: "Australian interview panels probe specifics. Because every claim traces to your verified profile, you can back up every single word without hesitation.",
  },
];

export function AustraliaSection() {
  return (
    <section id="australian-edge" className="sec-quiet bg-paper">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              The Australian Hiring Edge
            </span>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Built for how Australia actually hires.
            </h2>
            <p className="mt-3 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Overseas AI resume tools default to US conventions, American spellings, and exaggerated metrics that Australian hiring managers immediately discard.
            </p>
          </Reveal>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AU_PILLARS.map((card, idx) => (
            <Reveal key={card.title} delay={idx * 0.05}>
              <div className="market-card p-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                      {card.badge}
                    </span>
                    <CheckIcon className="w-3.5 h-3.5 text-success" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-bold text-ink">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
