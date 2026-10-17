import Link from "next/link";
import { MicIcon } from "@/components/ui/icons/LucideIcons";
import { formatEnAuDate } from "@/lib/dateUtils";
import type { PracticeSummary } from "@/lib/interview/history";

/** "Practised 2 times · last on 14 Oct · 3.6", linking to the latest practice report. */
export function PracticeSummaryLine({ summary }: { summary?: PracticeSummary }) {
  if (!summary) return null;
  return (
    <Link
      href={`/interview/${summary.lastSessionId}`}
      className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-ink-secondary hover:text-ink hover:underline"
    >
      <MicIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      Practised {summary.count} {summary.count === 1 ? "time" : "times"} · last on {formatEnAuDate(summary.lastAt)}
      {summary.lastScore !== null && ` · ${summary.lastScore.toFixed(1)}`}
    </Link>
  );
}
