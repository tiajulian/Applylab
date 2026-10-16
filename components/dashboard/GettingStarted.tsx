import Link from "next/link";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";

export interface SetupStep {
  title: string;
  /** One plain line on what this step is and why. */
  hint: string;
  done: boolean;
  href: string;
  action: string;
  /** Where "View" goes once the step is done (defaults to href). */
  doneHref?: string;
  /** Shown next to the title, e.g. "70% done" or "Pro". */
  tag?: string;
}

/**
 * The four job-hunt steps as a short checklist (the "getting started" list Teal, Notion and
 * similar tools use). The first unfinished step is highlighted with the only button in the list;
 * every other row is a quiet link, so it's always obvious what to do next.
 */
export function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="setup-title" className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <h2 id="setup-title" className="text-[15px] font-semibold text-ink">
          Get set up
        </h2>
        <span className="flex items-center gap-2.5 text-[12.5px] text-ink-muted">
          {doneCount} of {steps.length} done
          <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-paper-deep sm:block" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </span>
        </span>
      </div>

      <ol className="divide-y divide-border">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          return (
            <li
              key={step.title}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:px-5 ${
                isCurrent ? "bg-accent-soft/40" : ""
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                  step.done
                    ? "bg-success text-on-accent"
                    : isCurrent
                    ? "bg-accent-hover text-on-accent"
                    : "border border-border-strong text-ink-muted"
                }`}
              >
                {step.done ? <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {/* The highlighted row's text takes the full width on phones, pushing its button
                  onto its own line instead of squeezing the text. */}
              <span
                className={`flex min-w-0 grow flex-col ${
                  isCurrent ? "basis-[calc(100%-2.25rem)] sm:basis-0" : "basis-0"
                }`}
              >
                <span className="flex flex-wrap items-center gap-x-2">
                  <span className={`text-[14px] font-semibold ${step.done ? "text-ink-muted line-through" : "text-ink"}`}>
                    {step.title}
                  </span>
                  {step.tag && !step.done && <span className="text-[12px] font-medium text-ink-muted">{step.tag}</span>}
                  {step.done && <span className="sr-only">(done)</span>}
                </span>
                {!step.done && <span className="text-[12.5px] leading-snug text-ink-secondary">{step.hint}</span>}
              </span>
              {isCurrent ? (
                <Link
                  href={step.href}
                  className="ml-9 inline-flex h-9 shrink-0 items-center rounded-pill border border-accent/30 bg-accent-soft px-3.5 text-[13px] font-semibold text-accent-hover transition-colors hover:border-accent/50 hover:bg-accent/10 sm:ml-0 sm:h-8"
                >
                  {step.action}
                </Link>
              ) : (
                <Link
                  href={step.done ? step.doneHref ?? step.href : step.href}
                  className="shrink-0 text-[13px] font-medium text-ink-secondary underline decoration-border-strong underline-offset-4 hover:text-ink"
                >
                  {step.done ? "View" : step.action}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
