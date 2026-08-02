import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { Container } from "@/components/marketing/Container";

const ROWS = [
  {
    state: "matched" as const,
    task: "Balanced the till to the cent, every close",
    result: "Data accuracy & reconciliation",
    note: "Confirmed and added",
  },
  {
    state: "matched" as const,
    task: "Handled complaints on the floor without a manager",
    result: "Stakeholder management",
    note: "Confirmed and added",
  },
  {
    state: "confirm" as const,
    task: "Kept the shift roster running",
    result: "Resource planning?",
    note: "We think this counts, tell us more to confirm",
  },
  {
    state: "gap" as const,
    task: "Budget forecasting",
    result: "No matching experience found",
    note: "We won't add this unless you tell us about it",
  },
];

const STATE_STYLES = {
  matched: {
    dot: "bg-success",
    badge: "bg-success-soft text-success",
    label: "Matched",
  },
  confirm: {
    dot: "bg-attention",
    badge: "bg-attention-soft text-attention",
    label: "Worth confirming",
  },
  gap: {
    dot: "bg-ink-muted",
    badge: "bg-paper-deep text-ink-muted",
    label: "Honest gap",
  },
};

export function DifferentiatorSection() {
  return (
    <section className="border-t border-border bg-paper-deep py-20">
      <Container size="4xl">
        <Reveal>
          <h2 className="text-center font-display text-h2 text-ink">
            We find the skills you didn&rsquo;t know counted.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-3 text-center text-body-lg text-ink-secondary">
            Then we ask before we use them. Nothing goes on your resume unless it&rsquo;s true and
            you say yes.
          </p>
        </Reveal>

        <StaggerList className="mt-10 flex flex-col gap-3" staggerChildren={0.08}>
          {ROWS.map((row) => {
            const style = STATE_STYLES[row.state];
            return (
              <StaggerItem
                key={row.task}
                className="flex flex-col gap-3 rounded border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-pill ${style.dot}`} aria-hidden="true" />
                  <div>
                    <p className="text-sm text-ink">{row.task}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">{row.note}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-5 sm:pl-0">
                  <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${style.badge}`}>
                    {style.label}
                  </span>
                  <span className="text-sm font-medium text-ink-secondary">{row.result}</span>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      </Container>
    </section>
  );
}
