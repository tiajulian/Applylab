"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatEnAuDate } from "@/lib/dateUtils";
import { clsx } from "@/lib/utils";
import { STAGES } from "@/lib/interview/setupConstants";
import { SCORE_TONE_CLASSES, scoreLabel } from "@/lib/interview/scoreLabels";
import type { HistoryItem, HistoryStatus } from "@/lib/interview/history";

const STATUS: Record<HistoryStatus, { label: string; variant: "success" | "accent" | "neutral" }> = {
  finished: { label: "Finished", variant: "success" },
  in_progress: { label: "In progress", variant: "accent" },
  ended_early: { label: "Ended early", variant: "neutral" },
};

/** A session left open this long was walked away from, not one still being answered. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

/** "Your practice": every session, newest first, 10 a page. */
export function PracticeHistory({
  items,
  page,
  pageCount,
  onStartFirst,
}: {
  items: HistoryItem[];
  page: number;
  pageCount: number;
  onStartFirst: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<HistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !removed.has(i.id));

  async function confirmDelete() {
    if (!deleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/sessions/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRemoved((prev) => new Set(prev).add(deleting.id));
      setDeleting(null);
      router.refresh();
    } catch {
      setError("We couldn't delete that practice. Please try again.");
      setDeleting(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-3">
      <h2 id="history-heading" className="font-display text-[19px] font-semibold text-ink">
        Your practice
      </h2>

      {error && (
        <p role="alert" className="rounded bg-critical-soft p-3 text-sm text-ink">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface p-5 text-sm text-ink-secondary">
          Your practice sessions will show here.{" "}
          <button type="button" onClick={onStartFirst} className="font-semibold text-accent underline-offset-2 hover:underline">
            Start your first practice
          </button>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
          {visible.map((item) => {
            const stage = STAGES.find((s) => s.type === item.stageType)?.title ?? "Interview";
            const isStale = item.status === "in_progress" && Date.now() - new Date(item.createdAt).getTime() > STALE_AFTER_MS;
            const status = isStale ? { label: "Not finished", variant: "neutral" as const } : STATUS[item.status];
            const label = item.score !== null ? scoreLabel(item.score) : null;
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {item.jobTitle}
                    {item.company && <span className="font-normal text-ink-secondary"> · {item.company}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {formatEnAuDate(item.createdAt, { includeYear: true })} · {stage}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.status === "finished" &&
                    (label ? (
                      <span className={clsx("rounded-pill px-2.5 py-0.5 text-xs font-semibold", SCORE_TONE_CLASSES[label.tone])}>
                        {label.label} · {item.score!.toFixed(1)}
                      </span>
                    ) : item.coaching ? (
                      <Badge variant="neutral">Coaching</Badge>
                    ) : null)}
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {item.canOpen ? (
                    <Link
                      href={`/interview/${item.id}`}
                      className="rounded-pill border border-border px-3 py-1 text-xs font-semibold text-ink hover:bg-paper-deep"
                    >
                      {item.status === "in_progress" ? "Resume" : "View feedback"}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    aria-label={`Delete practice for ${item.jobTitle} on ${formatEnAuDate(item.createdAt)}`}
                    className="rounded px-2 py-1 text-xs font-medium text-ink-secondary hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <nav aria-label="Practice history pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/interview?page=${page - 1}#history-heading`} className="font-semibold text-accent hover:underline">
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={`/interview?page=${page + 1}#history-heading`} className="font-semibold text-accent hover:underline">
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this practice?"
          description="Its answers, feedback and report are deleted for good."
          confirmLabel="Delete"
          cancelLabel="Keep it"
          isDestructive
          isConfirming={isDeleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
