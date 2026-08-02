import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { Container } from "@/components/marketing/Container";

const STEPS = [
  {
    label: "1",
    title: "Add your history and paste the job ad.",
    description: "Tell us what you've actually done. Paste the job you want.",
  },
  {
    label: "2",
    title: "Confirm what's true.",
    description: "We suggest transferable skills you might have. You tick the real ones.",
  },
  {
    label: "3",
    title: "Get your resume.",
    description: "Honest, tailored, one page, ready to download.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20">
      <Container size="5xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">Three steps. No guesswork.</h2>
        </Reveal>

        <StaggerList className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <StaggerItem key={step.label} className="text-left">
              <div className="font-display text-h2 text-accent">{step.label}</div>
              <h3 className="mt-3 text-h3 font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.description}</p>
            </StaggerItem>
          ))}
        </StaggerList>
      </Container>
    </section>
  );
}
