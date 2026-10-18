import Link from "next/link";
import {
  btnOutline,
  btnPrimarySmall,
  card,
  row,
  rowBody,
  rowSub,
  rowTitle,
  sectionHead,
  sectionLink,
  sectionTitle,
} from "@/components/dashboard/home/homeStyles";

export interface HomeJob {
  id: string;
  title: string;
  /** Company initial (job title's when the company is unknown). */
  initial: string;
  /** "{company} · {location} · Posted {when}", with any missing part left out. */
  meta: string;
}

export function JobMatchesSection({ jobs }: { jobs: HomeJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <section aria-labelledby="jobs-h">
      <div className={sectionHead}>
        <h2 className={sectionTitle} id="jobs-h">
          New jobs that fit your profile
        </h2>
        <Link className={sectionLink} href="/job-matcher">
          See more jobs
        </Link>
      </div>
      <div className={card}>
        {jobs.map((job) => (
          <div key={job.id} className={row}>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-paper-deep text-[15px] font-semibold text-ink-secondary"
            >
              {job.initial}
            </span>
            <div className={rowBody}>
              <p className={`${rowTitle} truncate`} title={job.title}>
                {job.title}
              </p>
              <p className={rowSub}>{job.meta}</p>
            </div>
            <Link className={btnOutline} href={`/resume/new?job=${job.id}`}>
              Tailor resume
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface StageRow {
  label: string;
  count: number;
  href: string;
  color: string;
}

export function ApplicationsSummary({ stages, resumesReady = 0 }: { stages: StageRow[]; resumesReady?: number }) {
  return (
    <section
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
      aria-labelledby="apps-h"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitle} id="apps-h">
          Applications
        </h2>
        <Link className={sectionLink} href="/applications">
          View all
        </Link>
      </div>
      <div className="mt-4 flex h-2 gap-[3px] overflow-hidden rounded-lg bg-paper-deep" aria-hidden="true">
        {stages
          .filter((stage) => stage.count > 0)
          .map((stage) => (
            <div key={stage.label} style={{ flex: stage.count, background: stage.color }} />
          ))}
      </div>
      <ul className="mt-3">
        {stages.map((stage) => {
          const empty = stage.count === 0;
          return (
            <li key={stage.label} className="border-t border-paper-deep">
              <Link
                href={stage.href}
                className={`flex min-h-[44px] items-center justify-between text-[15px] no-underline hover:bg-paper ${
                  empty ? "text-ink-muted hover:text-ink-muted" : "text-ink hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: empty ? "var(--border)" : stage.color }} />
                  {stage.label}
                </span>
                <span className={`font-semibold ${empty ? "text-ink-muted" : ""}`}>{stage.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {resumesReady > 0 && (
        <Link
          href="/documents"
          className="mt-3 flex items-center justify-between border-t border-paper-deep pt-3 text-[14px] text-ink-secondary no-underline hover:text-ink"
        >
          <span>Resumes not sent yet</span>
          <span className="font-semibold">{resumesReady}</span>
        </Link>
      )}
    </section>
  );
}

export interface SetupStep {
  title: string;
  sub?: string;
  done: boolean;
  /** Current = the next step to do: its number and button turn orange. */
  current: boolean;
  action?: { label: string; href: string };
}

export function NewUserSteps({ steps }: { steps: SetupStep[] }) {
  return (
    <section className={`${card} mt-7 max-w-[760px]`} aria-label="Setup steps">
      {steps.map((step, index) => (
        <div key={step.title} className={row}>
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border-[1.5px] text-[14px] font-semibold ${
              step.done
                ? "border-success-soft bg-success-soft text-success"
                : step.current
                ? "border-accent bg-accent text-on-accent"
                : "border-border-strong text-ink-muted"
            }`}
          >
            {index + 1}
            {step.done && <span className="sr-only"> (done)</span>}
          </span>
          <div className={rowBody}>
            <p className={rowTitle}>{step.title}</p>
            {step.sub && <p className={rowSub}>{step.sub}</p>}
          </div>
          {step.action && (
            <Link className={step.current ? btnPrimarySmall : btnOutline} href={step.action.href}>
              {step.action.label}
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
