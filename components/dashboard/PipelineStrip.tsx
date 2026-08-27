"use client";

import Link from "next/link";
import { formatEnAuDate, diffCalendarDaysMelbourne } from "@/lib/dateUtils";
import type { PipelineCounts } from "@/lib/dashboard/pipeline";

interface PipelineStripProps {
  counts: PipelineCounts;
}

export function PipelineStrip({ counts }: PipelineStripProps) {
  // If all zero, spec 02 / 08 states pipeline does not render
  if (counts.total === 0) {
    return null;
  }

  // Determine if nextInterview attaches to Interview or Screening tile
  const isScreeningNext = counts.nextInterview?.stageType === "phone_screen";
  const isInterviewNext = counts.nextInterview && counts.nextInterview.stageType !== "phone_screen";

  function formatNextDate(isoDate: string): string {
    const days = diffCalendarDaysMelbourne(isoDate);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1 && days <= 6) {
      return formatEnAuDate(isoDate);
    }
    return formatEnAuDate(isoDate, { shortMonth: true });
  }

  const tiles = [
    {
      id: "drafted",
      label: "Drafted",
      count: counts.drafted,
      href: "/documents",
      subtitle: null,
      isHighlighted: false,
    },
    {
      id: "applied",
      label: "Applied",
      count: counts.applied,
      href: "/applications?stage=applied",
      subtitle: null,
      isHighlighted: false,
    },
    {
      id: "screening",
      label: "Screening",
      count: counts.screening,
      href: "/applications?stage=screening",
      subtitle: isScreeningNext && counts.nextInterview ? `Next ${formatNextDate(counts.nextInterview.scheduledAt)}` : null,
      isHighlighted: Boolean(isScreeningNext),
    },
    {
      id: "interview",
      label: "Interview",
      count: counts.interview,
      href: "/applications?stage=interview",
      subtitle: isInterviewNext && counts.nextInterview ? `Next ${formatNextDate(counts.nextInterview.scheduledAt)}` : null,
      isHighlighted: Boolean(isInterviewNext),
    },
    {
      id: "offer",
      label: "Offer",
      count: counts.offer,
      href: "/applications?stage=offer",
      subtitle: null,
      isHighlighted: false,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">
          Your pipeline{" "}
          <span className="ml-1 text-xs font-normal text-ink-muted">({counts.total})</span>
        </h2>
        <Link
          href="/applications"
          className="text-xs font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
        >
          View tracker &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <Link
            key={tile.id}
            href={tile.href}
            className={`flex flex-col justify-between rounded-lg border p-3.5 transition-[border-color,box-shadow,transform] duration-fast ease-editorial hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tile.isHighlighted
                ? "border-success/40 bg-success-soft/40 shadow-sm"
                : "border-border bg-surface hover:border-border-strong hover:bg-paper"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span
                className={`font-display text-2xl font-bold tracking-tight ${
                  tile.count > 0 ? "text-ink" : "text-ink-muted opacity-60"
                }`}
              >
                {tile.count}
              </span>
            </div>
            <div className="mt-1 flex flex-col">
              <span className="text-xs font-medium text-ink-secondary">{tile.label}</span>
              {tile.subtitle && (
                <span className="mt-0.5 text-[11px] font-semibold text-success">
                  {tile.subtitle}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
