import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { Container } from "@/components/marketing/Container";

const FORMAT_POINTS = [
  "Australian English spelling and phrasing",
  "SEEK and Workday-ready formatting",
  "One-page conventions local recruiters expect",
];

export function AustraliaSection() {
  return (
    <section className="py-20">
      <Container size="4xl" className="text-center">
        <Reveal>
          <h2 className="font-display text-h2 text-ink">Made for how Australia hires.</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-secondary">
            Australian English, SEEK and Workday-ready formatting, and the one-page conventions
            local recruiters expect.
          </p>
        </Reveal>

        <StaggerList className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
          {FORMAT_POINTS.map((point) => (
            <StaggerItem
              key={point}
              className="flex items-center gap-2 rounded-pill border border-border-strong bg-surface px-4 py-2 text-sm text-ink-secondary sm:flex-1"
            >
              <span className="text-success" aria-hidden="true">
                ✓
              </span>
              {point}
            </StaggerItem>
          ))}
        </StaggerList>
      </Container>
    </section>
  );
}
