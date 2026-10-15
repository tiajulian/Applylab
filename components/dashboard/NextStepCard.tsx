import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";
import { STEP_NAV_ITEMS } from "@/components/dashboard/sidebarNavItems";

export interface NextStep {
  /** Which of the four job-hunt steps (1-4) this action belongs to. */
  step: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  cta: { href: string; label: string };
  secondary?: { href: string; label: string };
}

/**
 * The one thing to do next, plus where it sits in the four-step job hunt. This is the only
 * accent-coloured button on the dashboard (DESIGN.md's One Signal Rule), so a first-time user
 * never has to choose between competing calls to action.
 */
export function NextStepCard({ next, done }: { next: NextStep; done: [boolean, boolean, boolean, boolean] }) {
  return (
    <section
      aria-labelledby="next-step-title"
      className="overflow-hidden rounded-[22px] border border-border bg-surface shadow"
    >
      <ol className="grid grid-cols-4 border-b border-border bg-paper-deep/50" aria-label="Your job hunt steps">
        {STEP_NAV_ITEMS.map((item, i) => {
          const isCurrent = item.step === next.step;
          const isDone = done[i] && !isCurrent;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex h-full flex-col items-center gap-1.5 px-1 py-3 text-center transition-colors duration-fast ease-editorial sm:flex-row sm:justify-center sm:gap-2 sm:px-3 ${
                  isCurrent ? "bg-surface" : "hover:bg-paper-deep"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
                    isCurrent
                      ? "bg-accent-hover text-on-accent"
                      : isDone
                      ? "bg-success text-on-accent"
                      : "border border-border-strong bg-surface text-ink-muted"
                  }`}
                >
                  {isDone ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} /> : item.step}
                </span>
                <span
                  className={`text-[11.5px] leading-tight sm:truncate sm:text-[13px] ${
                    isCurrent ? "font-semibold text-ink" : "font-medium text-ink-muted"
                  }`}
                >
                  {item.shortLabel ?? item.label}
                  {isDone && <span className="sr-only"> (done)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:p-8">
        <div className="max-w-[52ch]">
          <h2 id="next-step-title" className="font-display text-[26px] font-semibold leading-[1.15] text-ink sm:text-[30px]">
            {next.title}
          </h2>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-secondary">{next.body}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:items-end">
          <Button href={next.cta.href} size="lg" className="justify-center rounded-pill">
            {next.cta.label} <ArrowRightIcon className="h-4 w-4" />
          </Button>
          {next.secondary && (
            <Link
              href={next.secondary.href}
              className="text-center text-[13.5px] font-medium text-ink-secondary underline decoration-border-strong underline-offset-4 hover:text-ink hover:decoration-ink"
            >
              {next.secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
