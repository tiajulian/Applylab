"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import {
  BriefcaseIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  StarIcon,
  XIcon,
} from "@/components/ui/icons/LucideIcons";
import { contractLabel, daysSince, formatSalaryRange, matchLabel, postedLabel } from "@/lib/jobs/format";
import type { JobDto } from "@/lib/jobs/client";
import { clsx } from "@/lib/utils";

interface JobCardProps {
  job: JobDto;
  saved: boolean;
  onToggleSave: () => void;
  onApply: () => void;
  /** Match percentage and reasons; omitted in the Saved list. */
  score?: number;
  reasons?: string[];
  onDismiss?: () => void;
  /** The job is no longer listed on Adzuna (expired). */
  expired?: boolean;
}

// Salary and posting date already show in the details line, so their reasons would repeat them.
const REPEATS_DETAILS = /^(estimated salary|salary|posted)/i;
// "Mentions SQL, Excel" - the user's skills found in the ad, shown as tags instead of a reason.
const MENTIONS = /^Mentions (.+)$/;

const quietAction =
  "inline-flex h-9 items-center gap-1.5 rounded-pill px-2.5 text-sm font-medium transition-[background-color,color] duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Up to two initials from the company name, for the logo placeholder. */
function initials(company: string | null): string {
  const words = (company ?? "").replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

const RING_RADIUS = 21;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function MatchScore({ score }: { score: number }) {
  const label = matchLabel(score);
  const strong = score >= 55;
  return (
    <div className="flex items-center gap-3" aria-label={`${score}% match, ${label.toLowerCase()}`} role="img">
      <div className="relative h-12 w-12 shrink-0">
        <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden="true">
          <circle cx="24" cy="24" r={RING_RADIUS} fill="none" strokeWidth="3" className="stroke-border" />
          <circle
            cx="24"
            cy="24"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - Math.min(100, Math.max(0, score)) / 100)}
            className={strong ? "stroke-success" : "stroke-ink-muted"}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tabular-nums text-ink" aria-hidden="true">
          {score}
          <span className="text-[10px] font-medium text-ink-secondary">%</span>
        </span>
      </div>
      <span className={clsx("text-meta font-medium leading-tight", strong ? "text-success" : "text-ink-secondary")} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}

/** One job in a list (the list provides the Adzuna attribution). */
export function JobCard({ job, saved, onToggleSave, onApply, score, reasons = [], onDismiss, expired }: JobCardProps) {
  const [showWhy, setShowWhy] = useState(false);
  const whyId = useId();
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax);
  const days = daysSince(job.postedAt, Date.now());
  const contract = contractLabel(job.contractTime, job.contractType);
  const meetsMinimum = reasons.some((r) => r.endsWith("meets your minimum"));
  const skills = reasons.map((r) => MENTIONS.exec(r)?.[1]).find(Boolean)?.split(", ") ?? [];
  const why = reasons.filter((r) => !REPEATS_DETAILS.test(r) && !MENTIONS.test(r));
  const hasScore = score !== undefined;

  return (
    <article
      className={clsx(
        "grid grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-sm border border-border bg-surface p-4 transition-[border-color,background-color] duration-fast ease-editorial hover:border-border-strong hover:bg-paper sm:gap-x-4 sm:p-5",
        hasScore ? "sm:grid-cols-[48px_minmax(0,1fr)_176px]" : "sm:grid-cols-[48px_minmax(0,1fr)]"
      )}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-paper text-sm font-semibold text-ink-secondary sm:h-12 sm:w-12"
        aria-hidden="true"
      >
        {initials(job.company)}
      </div>

      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-snug text-ink sm:text-[17px]">{job.title}</h3>
        <p className="mt-0.5 truncate text-sm text-ink-secondary">
          {job.company && <span className="font-medium text-ink">{job.company}</span>}
          {job.company && job.location && " · "}
          {job.location}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted">
          {contract && (
            <span className="inline-flex items-center gap-1">
              <BriefcaseIcon className="h-3.5 w-3.5" aria-hidden="true" /> {contract}
            </span>
          )}
          {salary && (
            <span className="font-medium tabular-nums text-ink-secondary">
              {salary}
              {job.salaryIsPredicted && <span className="font-normal text-ink-muted"> (est.)</span>}
            </span>
          )}
          {meetsMinimum && (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Meets your minimum
            </span>
          )}
          {days !== null && (
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" /> {postedLabel(days)}
            </span>
          )}
          {expired && <Badge variant="neutral">No longer listed</Badge>}
        </p>
        {job.snippet && <p className="mt-2 line-clamp-2 max-w-[70ch] text-meta text-ink-secondary">{job.snippet}</p>}
      </div>

      {hasScore && (
        <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-start sm:justify-start">
          <MatchScore score={score} />
          {why.length > 0 && (
            <button
              type="button"
              aria-expanded={showWhy}
              aria-controls={whyId}
              onClick={() => setShowWhy((v) => !v)}
              className="inline-flex items-center gap-1 rounded-sm text-meta font-medium text-ink-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Why this matches
              <ChevronDownIcon
                className={clsx("h-3.5 w-3.5 transition-transform duration-fast ease-editorial", showWhy && "rotate-180")}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      )}

      {showWhy && (
        <ul
          id={whyId}
          aria-label="Why this matches"
          className="col-span-2 flex flex-col gap-1 rounded-[10px] bg-paper-deep px-3 py-2 text-meta text-ink-secondary sm:col-span-2 sm:col-start-2"
        >
          {why.map((reason) => (
            <li key={reason} className="flex items-center gap-2">
              <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" /> {reason}
            </li>
          ))}
        </ul>
      )}

      <div
        className={clsx(
          "col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:col-start-2",
          hasScore ? "sm:col-span-2" : "sm:col-span-1"
        )}
      >
        {skills.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Your skills in this ad">
            {skills.map((skill) => (
              <li key={skill} className="rounded-pill border border-border bg-paper px-2 py-0.5 text-xs text-ink-secondary">
                {skill}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}

        <div className="ml-auto flex items-center gap-1">
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={clsx(quietAction, "text-ink-muted hover:bg-paper-deep hover:text-ink")}>
              <XIcon className="h-4 w-4" aria-hidden="true" />
              Dismiss
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={clsx(quietAction, "text-ink-secondary hover:bg-paper-deep hover:text-ink")}
          >
            <StarIcon className={clsx("h-4 w-4", saved && "fill-current text-accent")} aria-hidden="true" />
            {saved ? "Saved" : "Save"}
          </button>
          {!expired && (
            // Adzuna's redirect_url exactly as returned (tracking parameters required by their terms).
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener"
              onClick={onApply}
              aria-label={`Apply for ${job.title} (opens in a new tab)`}
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-pill bg-accent-hover px-4 text-sm font-semibold text-on-accent transition-[filter] duration-fast ease-editorial hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Apply <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
