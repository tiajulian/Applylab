import Link from "next/link";
import { formatEnAuDate, diffCalendarDaysMelbourne } from "@/lib/dateUtils";
import type { PipelineCounts } from "@/lib/dashboard/pipeline";

interface PipelineStripProps {
  counts: PipelineCounts;
}

function formatNextDate(isoDate: string): string {
  const days = diffCalendarDaysMelbourne(isoDate);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days <= 6) return formatEnAuDate(isoDate);
  return formatEnAuDate(isoDate, { shortMonth: true });
}

/** Where every job stands, in plain words: one row of counts that link into the tracker. */
export function PipelineStrip({ counts }: PipelineStripProps) {
  if (counts.total === 0) return null;

  const isScreeningNext = counts.nextInterview?.stageType === "phone_screen";
  const nextLabel = counts.nextInterview ? `Next ${formatNextDate(counts.nextInterview.scheduledAt)}` : null;

  const tiles = [
    { id: "drafted", label: "Not sent yet", count: counts.drafted, href: "/documents", note: null },
    { id: "applied", label: "Applied", count: counts.applied, href: "/applications?stage=applied", note: null },
    {
      id: "screening",
      label: "Phone screen",
      count: counts.screening,
      href: "/applications?stage=screening",
      note: isScreeningNext ? nextLabel : null,
    },
    {
      id: "interview",
      label: "Interview",
      count: counts.interview,
      href: "/applications?stage=interview",
      note: counts.nextInterview && !isScreeningNext ? nextLabel : null,
    },
    { id: "offer", label: "Offer", count: counts.offer, href: "/applications?stage=offer", note: null },
  ];

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pipeline-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pipeline-title" className="text-[17px] font-semibold text-ink">
          Where your applications are
        </h2>
        <Link href="/applications" className="text-[13.5px] font-semibold text-accent-hover hover:underline">
          See all
        </Link>
      </div>

      <ul className="grid grid-cols-5 divide-x divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {tiles.map((tile) => (
          <li key={tile.id} className="min-w-0">
            <Link
              href={tile.href}
              aria-label={`${tile.count} ${tile.label}${tile.note ? `, ${tile.note}` : ""}`}
              className="flex h-full flex-col items-center gap-1 px-1 py-4 text-center transition-colors duration-fast ease-editorial hover:bg-paper-deep/60 sm:items-start sm:px-4 sm:text-left"
            >
              <span
                className={`font-display text-[24px] font-semibold leading-none tabular-nums sm:text-[28px] ${
                  tile.count > 0 ? "text-ink" : "text-ink-muted/50"
                }`}
              >
                {tile.count}
              </span>
              <span className="text-[11.5px] font-medium leading-tight text-ink-secondary sm:text-[13px]">
                {tile.label}
              </span>
              {tile.note && (
                <span className="text-[11px] font-semibold leading-tight text-success sm:text-[12px]">{tile.note}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
