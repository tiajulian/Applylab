import type { ReactNode } from "react";
import Link from "next/link";
import {
  btnOutline,
  btnPrimarySmall,
  card,
  iconOrange,
  row,
  rowBody,
  rowIcon,
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

export interface NextStep {
  title: string;
  sub: string;
  href: string;
  action: string;
  icon: "profile" | "send" | "search" | "mic" | "puzzle";
  /** Draws a progress bar (profile completeness). */
  percent?: number;
  /** Shown as a small "Pro" tag beside the title. */
  pro?: boolean;
}

const NEXT_STEP_ICONS: Record<NextStep["icon"], ReactNode> = {
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" />,
  mic: <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  puzzle: <path d="M9 4h6v3a2 2 0 1 0 4 0h1v6h-3a2 2 0 1 0 0 4h3v3H4V4h5" />,
};

/** Fills the left column when there's nothing to do and no job matches yet. */
export function NextStepsSection({ steps }: { steps: NextStep[] }) {
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby="next-h">
      <div className={sectionHead}>
        <h2 className={sectionTitle} id="next-h">
          Make the most of applylab
        </h2>
      </div>
      <ul className={card}>
        {steps.map((step, index) => {
          // The first step is the one to do next: it alone gets a filled button, the rest are quiet rows.
          const featured = index === 0;
          return (
            <li key={step.title}>
              <Link
                href={step.href}
                className={`${row} group text-ink no-underline transition-colors hover:bg-paper hover:text-ink max-md:flex-nowrap max-sm:items-start`}
              >
                <span className={`${rowIcon} ${featured ? "bg-accent text-on-accent" : iconOrange}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    {NEXT_STEP_ICONS[step.icon]}
                  </svg>
                </span>
                <span className={rowBody}>
                  <span className={`${rowTitle} block`}>
                    {step.title}
                    {step.pro && (
                      <span className="ml-2 inline-block rounded-full bg-paper-deep px-2 py-0.5 align-[2px] text-[11px] font-semibold leading-none text-ink-secondary">
                        Pro
                      </span>
                    )}
                  </span>
                  <span className={`${rowSub} block`}>{step.sub}</span>
                  {step.percent !== undefined && (
                    <span className="mt-2.5 flex items-center gap-3">
                      <span aria-hidden="true" className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-paper-deep">
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${step.percent}%` }} />
                      </span>
                      <span className="text-[13px] font-semibold text-ink-secondary">{step.percent}% complete</span>
                    </span>
                  )}
                </span>
                {featured && <span className={`${btnPrimarySmall} max-sm:hidden`}>{step.action}</span>}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 flex-none self-center text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink ${
                    featured ? "sm:hidden" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
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
