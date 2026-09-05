import { Reveal } from "@/components/ui/Reveal";
import { Container } from "@/components/marketing/Container";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

const TRUST_COMMITMENTS = [
  {
    title: "Every claim traces to something you actually did",
    desc: "Companies, qualifications, job titles, duties, and tools all originate from your verified profile. We never fabricate metrics, employers, or certifications.",
  },
  {
    title: "Gaps get flagged honestly, not covered up",
    desc: "If a job ad asks for a tool or skill you have never used, ApplyLab flags it honestly as a gap and prepares you for interview questions, rather than inventing false claims.",
  },
  {
    title: "100% defensible in panel interviews",
    desc: "Because nothing is invented, you can walk into any Australian panel interview confident you can back up every single word without hesitation or fear of being caught out.",
  },
];

export function HonestExperienceTrustSection() {
  return (
    <section id="trust" className="sec-loud dark-band-glow">
      <Container size="marketing">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Heading & Lede */}
          <div className="lg:col-span-6 flex flex-col items-start">
            <Reveal>
              <span className="text-meta font-semibold uppercase tracking-wider text-accent">
                Truth and Integrity
              </span>
              {/* Measure is directly on the 54px heading itself, avoiding shared wrapper ch bug */}
              <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-[54px] leading-[1.2] font-bold tracking-tight text-paper max-w-[18ch]">
                Your application should never tell a story you didn&rsquo;t live.
              </h2>
              <p className="mt-5 text-[16px] sm:text-[17.5px] text-paper/80 leading-relaxed max-w-xl">
                Generic AI tools invent achievements to trick keyword scanners. ApplyLab works strictly from your verified evidence chain so you can speak to every claim with confidence.
              </p>
            </Reveal>
          </div>

          {/* Right Column: 3 High-Contrast Cards */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {TRUST_COMMITMENTS.map((item, idx) => (
              <Reveal key={item.title} delay={idx * 0.08}>
                <div className="rounded-lg border border-white/15 bg-white/[0.05] p-5 sm:p-6 transition-all duration-300 hover:border-white/25 hover:bg-white/[0.08] hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-accent/20 p-1 mt-0.5 shrink-0 text-accent">
                      <CheckIcon className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-paper">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm text-paper/70 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
