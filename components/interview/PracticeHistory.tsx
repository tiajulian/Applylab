"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChevronDownIcon, TrashIcon } from "@/components/ui/icons/LucideIcons";
import { formatEnAuDate } from "@/lib/dateUtils";
import { clsx } from "@/lib/utils";
import { STAGES } from "@/lib/interview/setupConstants";
import { SCORE_TONE_CLASSES, scoreLabel } from "@/lib/interview/scoreLabels";
import { groupHistoryByJob, resumablePractice, type HistoryItem } from "@/lib/interview/history";

/** Jobs shown before "Show all". */
const COLLAPSED_JOB_COUNT = 5;

const stageTitle = (item: HistoryItem) => STAGES.find((s) => s.type === item.stageType)?.title ?? "Interview";

function ScorePill({ score }: { score: number }) {
  const label = scoreLabel(score);
  return (
    <span className={clsx("whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold", SCORE_TONE_CLASSES[label.tone])}>
      {label.label} · {score.toFixed(1)}
    </span>
  );
}

/** What a practice came to: its score, else where it stopped. */
function outcome(item: HistoryItem): React.ReactNode {
  if (item.status === "finished" && item.score !== null) return <ScorePill score={item.score} />;
  const text = item.status === "in_progress" ? "Not finished" : item.status === "ended_early" ? "Ended early" : item.coaching ? "Coaching" : "Finished";
  return <span className="whitespace-nowrap text-xs text-ink-muted">{text}</span>;
}

/** "Your practice": one row per job, opened to see each practice. The newest unfinished one
 *  from the last week sits on top so it's easy to carry on. */
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
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => items.filter((i) => !removed.has(i.id)), [items, removed]);
  const groups = useMemo(() => groupHistoryByJob(visible), [visible]);
  // The viewer's clock, read after mount so the server and first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const resumable = useMemo(() => (now === null ? null : resumablePractice(visible, now)), [visible, now]);
  const shownGroups = showAll ? groups : groups.slice(0, COLLAPSED_JOB_COUNT);

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
        <>
          {resumable && (
            <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">Pick up where you left off</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">
                  {resumable.jobTitle}
                  {resumable.company && <span className="font-normal text-ink-secondary"> · {resumable.company}</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {stageTitle(resumable)} · started {formatEnAuDate(resumable.createdAt)}
                </p>
              </div>
              <Button href={`/interview/${resumable.id}`} size="sm" className="shrink-0 self-start rounded-pill sm:self-center">
                Carry on
              </Button>
            </div>
          )}

          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
            {shownGroups.map((group) => {
              const isOpen = openKey === group.key;
              const panelId = `history-${group.key.replace(/[^a-z0-9]+/g, "-")}`;
              return (
                <li key={group.key}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenKey(isOpen ? null : group.key)}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-paper-deep/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {group.jobTitle}
                        {group.company && <span className="font-normal text-ink-secondary"> · {group.company}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {group.items.length} {group.items.length === 1 ? "practice" : "practices"} · last on{" "}
                        {formatEnAuDate(group.items[0].createdAt, { includeYear: true })}
                      </span>
                    </span>
                    <span className="hidden shrink-0 sm:block">
                      {group.latestScore !== null ? (
                        <ScorePill score={group.latestScore} />
                      ) : (
                        <span className="text-xs text-ink-muted">No score yet</span>
                      )}
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={clsx("h-4 w-4 shrink-0 text-ink-secondary transition-transform duration-fast", isOpen && "rotate-180")}
                      strokeWidth={2}
                    />
                  </button>

                  {isOpen && (
                    <ul id={panelId} className="mx-4 mb-4 flex flex-col divide-y divide-border rounded-lg border border-border bg-paper">
                      {group.items.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                          <span className="min-w-0 flex-1 text-xs text-ink-secondary">
                            <span className="font-medium text-ink">{formatEnAuDate(item.createdAt, { includeYear: true })}</span> ·{" "}
                            {stageTitle(item)}
                          </span>
                          {outcome(item)}
                          {item.canOpen && (
                            <Link
                              href={`/interview/${item.id}`}
                              className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-semibold text-ink hover:bg-paper-deep"
                            >
                              {item.status === "in_progress" ? "Carry on" : "Feedback"}
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleting(item)}
                            aria-label={`Delete practice for ${item.jobTitle} on ${formatEnAuDate(item.createdAt)}`}
                            className="rounded p-1.5 text-ink-muted hover:bg-critical-soft hover:text-critical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {groups.length > COLLAPSED_JOB_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="self-start rounded text-sm font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {showAll ? "Show fewer jobs" : `Show all ${groups.length} jobs`}
            </button>
          )}
        </>
      )}

      {pageCount > 1 && (
        <nav aria-label="Practice history pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/interview?page=${page - 1}#history-heading`} className="font-semibold text-accent hover:underline">
              Newer practice
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink-muted">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={`/interview?page=${page + 1}#history-heading`} className="font-semibold text-accent hover:underline">
              Older practice
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
