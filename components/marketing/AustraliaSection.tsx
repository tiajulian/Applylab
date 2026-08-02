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
      <Container size="5xl" className="text-center">
        <Reveal>
          <h2 className="font-display text-h2 text-ink">Made for how Australia hires.</h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mx-auto mt-3 max-w-xl text-body-lg text-ink-secondary">
            Australian English, SEEK and Workday-ready formatting, and the one-page conventions
            local recruiters expect.
          </p>
        </Reveal>

        <StaggerList className="mt-9 grid gap-4 sm:grid-cols-3">
          {FORMAT_POINTS.map((point) => (
            <StaggerItem
              key={point}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-4 py-3.5 text-left text-sm text-ink-secondary"
            >
              <span className="text-success" aria-hidden="true">
                &#10003;
              </span>
              {point}
            </StaggerItem>
          ))}
        </StaggerList>
      </Container>
    </section>
  );
}
