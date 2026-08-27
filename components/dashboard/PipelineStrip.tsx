"use client";

import Link from "next/link";
import { formatEnAuDate, diffCalendarDaysMelbourne } from "@/lib/dateUtils";
import type { PipelineCounts } from "@/lib/dashboard/pipeline";

interface PipelineStripProps {
  counts: PipelineCounts;
}

export function PipelineStrip({ counts }: PipelineStripProps) {
  // If all zero, spec states pipeline does not render
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
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-semibold text-ink flex items-baseline gap-1.5">
          <span>Your pipeline</span>
          <span className="font-normal text-xs text-ink-muted">({counts.total})</span>
        </h2>
        <Link
          href="/applications"
          className="text-xs font-semibold text-accent transition-colors hover:text-accent-hover hover:underline"
        >
          Open board &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[11px]">
        {tiles.map((tile) => (
          <Link
            key={tile.id}
            href={tile.href}
            tabIndex={0}
            aria-label={`${tile.count} applications, ${tile.label}`}
            className={`flex flex-col justify-between rounded-lg border px-4 py-3.5 shadow-sm transition-all duration-fast ease-editorial hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
              tile.isHighlighted
                ? "border-success/60 bg-success-soft"
                : "border-border bg-surface hover:border-border-strong"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span
                className={`font-display text-[26px] font-bold leading-tight ${
                  tile.count > 0 ? "text-ink" : "text-ink-muted opacity-40"
                }`}
              >
                {tile.count}
              </span>
            </div>
            <div className="mt-1 flex flex-col">
              <span className="text-[12.5px] font-semibold text-ink-secondary tracking-tight">
                {tile.label}
              </span>
              {tile.subtitle && (
                <span className="mt-0.5 text-[11.5px] font-semibold text-success">
                  {tile.subtitle}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
