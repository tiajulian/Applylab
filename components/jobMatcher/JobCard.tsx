"use client";

import { Badge } from "@/components/ui/Badge";
import { CheckIcon, ExternalLinkIcon, StarIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { daysSince, formatSalaryRange, postedLabel } from "@/lib/jobs/format";
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

const iconButton =
  "inline-flex h-9 items-center gap-1.5 rounded-pill px-2.5 text-sm font-medium text-ink-secondary transition-[background-color,color] duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One job in a list (the list provides the surface and the Adzuna attribution). */
export function JobCard({ job, saved, onToggleSave, onApply, score, reasons = [], onDismiss, expired }: JobCardProps) {
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax);
  const days = daysSince(job.postedAt, Date.now());
  const meetsMinimum = reasons.some((r) => r.endsWith("meets your minimum"));
  const why = reasons.filter((r) => !REPEATS_DETAILS.test(r));
  const details = [job.company, job.location].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-ink">{job.title}</h3>
          {details && <p className="mt-0.5 text-sm text-ink-secondary">{details}</p>}
        </div>
        {score !== undefined && (
          <p className="shrink-0 text-right leading-none" aria-label={`${score}% match`}>
            <span className="block text-lg font-semibold tabular-nums text-ink">{score}%</span>
            <span className="text-xs text-ink-muted">match</span>
          </p>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {salary && (
          <span className="font-medium tabular-nums text-ink">
            {salary}
            {job.salaryIsPredicted && <span className="font-normal text-ink-muted"> (est.)</span>}
          </span>
        )}
        {meetsMinimum && (
          <span className="inline-flex items-center gap-1 text-success">
            <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> Meets your minimum
          </span>
        )}
        {days !== null && <span className="text-ink-muted">{postedLabel(days)}</span>}
        {expired && <Badge variant="neutral">No longer listed</Badge>}
      </p>

      {job.snippet && <p className="line-clamp-2 max-w-[75ch] text-sm leading-relaxed text-ink-secondary">{job.snippet}</p>}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {why.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Why this matches">
            {why.map((reason) => (
              <li key={reason} className="rounded-pill bg-paper-deep px-2.5 py-1 text-xs text-ink-secondary">
                {reason}
              </li>
            ))}
          </ul>
        ) : (
          <span />
        )}

        <div className="ml-auto flex items-center gap-1">
          {onDismiss && (
            <button type="button" onClick={onDismiss} className={iconButton} aria-label="Dismiss">
              <XIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Dismiss</span>
            </button>
          )}
          <button type="button" onClick={onToggleSave} className={iconButton} aria-pressed={saved} aria-label={saved ? "Saved" : "Save"}>
            <StarIcon className={clsx("h-4 w-4", saved && "fill-current text-accent")} aria-hidden="true" />
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </button>
          {!expired && (
            // Adzuna's redirect_url exactly as returned (tracking parameters required by their terms).
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener"
              onClick={onApply}
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink shadow-sm transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Apply <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
