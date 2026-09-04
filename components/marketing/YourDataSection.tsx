import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

const PRIVACY_PILLARS = [
  {
    title: "Stored securely in Australia",
    badge: "Local Data Sovereignty",
    desc: "Your profile, resumes, and career details are encrypted and stored in Australia. We never sell your personal data or use your documents to train public AI models.",
  },
  {
    title: "Interview audio discarded immediately",
    badge: "Ephemeral Audio",
    desc: "When you practise with the AI Interview Coach, your speech is transcribed and scored live. Audio recordings are never retained or saved on our servers.",
  },
  {
    title: "Zero auto-apply bots",
    badge: "Human-In-The-Loop",
    desc: "The Chrome extension never auto-submits. There is no automated spray-and-pray mode, and we will not build one. You stay in full control of every application.",
  },
  {
    title: "Instant account deletion",
    badge: "Total Ownership",
    desc: "Delete your account at any time with a single click. Your profile, applications, tailored resumes, and cached tokens are permanently purged immediately.",
  },
];

export function YourDataSection() {
  return (
    <section id="your-data" className="sec bg-paper border-b border-border/60">
      <Container size="marketing">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Your Data and Privacy
            </span>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Your career data belongs to you, not an AI training pool.
            </h2>
            <p className="mt-4 text-[16px] sm:text-[17.5px] text-ink-secondary leading-relaxed max-w-xl mx-auto">
              Installing an extension and uploading resumes requires complete trust. Here is exactly how we protect your career history and privacy.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRIVACY_PILLARS.map((item, idx) => (
            <Reveal key={item.title} delay={idx * 0.06}>
              <div className="market-card p-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
                      {item.badge}
                    </span>
                    <CheckIcon className="w-3.5 h-3.5 text-success" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-bold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
                    {item.desc}
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
