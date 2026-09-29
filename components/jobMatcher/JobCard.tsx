"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Building2Icon, ExternalLinkIcon, MapPinIcon, StarIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { AdzunaAttribution } from "@/components/jobMatcher/AdzunaAttribution";
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

export function JobCard({ job, saved, onToggleSave, onApply, score, reasons = [], onDismiss, expired }: JobCardProps) {
  const salary = formatSalaryRange(job.salaryMin, job.salaryMax);
  const days = daysSince(job.postedAt, Date.now());

  return (
    <Card density="compact" className="flex flex-col gap-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">{job.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
            {job.company && (
              <span className="inline-flex items-center gap-1">
                <Building2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {job.company}
              </span>
            )}
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {job.location}
              </span>
            )}
          </p>
        </div>
        {score !== undefined && (
          <Badge variant="accent" className="shrink-0" aria-label={`${score}% match`}>
            {score}% match
          </Badge>
        )}
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-1 text-meta text-ink-muted">
        {salary && (
          <span className="font-medium text-ink-secondary">
            {salary}
            {job.salaryIsPredicted && <span className="font-normal text-ink-muted"> (est.)</span>}
          </span>
        )}
        {days !== null && <span>{postedLabel(days)}</span>}
        {expired && <Badge variant="neutral">No longer listed</Badge>}
      </p>

      {job.snippet && <p className="line-clamp-2 text-sm text-ink-secondary">{job.snippet}</p>}

      {reasons.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Why this matches">
          {reasons.map((reason) => (
            <li key={reason} className="rounded-pill bg-paper-deep px-2.5 py-1 text-xs text-ink-secondary">
              {reason}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <AdzunaAttribution />
        <div className="flex flex-wrap items-center gap-2">
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss} className="text-ink-secondary hover:bg-paper-deep">
              <XIcon className="h-4 w-4" /> Dismiss
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onToggleSave} aria-pressed={saved}>
            <StarIcon className={clsx("h-4 w-4", saved && "fill-current text-accent")} /> {saved ? "Saved" : "Save"}
          </Button>
          {!expired && (
            // Adzuna's redirect_url exactly as returned (tracking parameters required by their terms).
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener"
              onClick={onApply}
              className="inline-flex h-9 items-center gap-2 rounded-pill bg-accent-hover px-3 text-sm font-medium text-on-accent shadow-sm transition-[filter,transform] duration-fast ease-editorial hover:-translate-y-px hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Apply <ExternalLinkIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
