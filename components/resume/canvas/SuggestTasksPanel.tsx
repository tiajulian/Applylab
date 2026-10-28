"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { CheckIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { LimitReachedInline } from "@/components/upgrade/LimitReachedInline";
import { CanvasSheet } from "@/components/resume/canvas/CanvasSheet";
import { useSuggestedTasks } from "@/lib/resume/useSuggestedTasks";
import { newTasksForRole, roleTaskMatcher, taskText, writtenBulletCount } from "@/lib/resume/suggestTasks";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import type { ResumeExperienceEntry, RoleDutyItem } from "@/types";

const chipClass = (active: boolean) =>
  clsx(
    "min-h-8 shrink-0 rounded-pill border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink"
  );

/**
 * The resume editor's Suggest tasks panel for one role: common tasks for its job title, ticked and
 * added as bullets. Only what the candidate ticks lands on the resume, worded as suggested - they
 * can reword any bullet afterwards with its ✦. Tasks the role already has are shown, greyed, so
 * the list never looks like it's missing them.
 */
export function SuggestTasksPanel({
  role,
  onAdd,
  onClose,
}: {
  role: ResumeExperienceEntry;
  onAdd: (texts: string[]) => void;
  onClose: () => void;
}) {
  const jobTitle = role.job_title.trim();
  const tasks = useSuggestedTasks({ jobTitle, company: role.company, location: role.location });
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Rejected ones stay out - the candidate said no to them on their profile. What the role already
  // has goes last, greyed, rather than vanishing.
  const { offered, onRole } = useMemo(() => {
    const isOnRole = roleTaskMatcher(role);
    const split = { offered: [] as RoleDutyItem[], onRole: [] as RoleDutyItem[] };
    for (const item of tasks.items) {
      if (item.user_state === "rejected" || !taskText(item)) continue;
      (isOnRole(taskText(item)) ? split.onRole : split.offered).push(item);
    }
    return split;
  }, [tasks.items, role]);
  const categories = useMemo(
    () => Array.from(new Set(offered.map((item) => item.category?.trim()).filter((c): c is string => Boolean(c)))),
    [offered]
  );
  const shown = category ? offered.filter((item) => item.category?.trim() === category) : offered;

  useEffect(() => {
    trackFunnelEvent("suggest_tasks_opened", { hasBullets: writtenBulletCount(role) > 0 });
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard users land on the first task once the list arrives (once only - not on "More ideas").
  const focusedRef = useRef(false);
  useEffect(() => {
    if (tasks.status !== "ready" || focusedRef.current) return;
    focusedRef.current = true;
    listRef.current?.querySelector<HTMLInputElement>("input[type=checkbox]:not(:disabled)")?.focus();
  }, [tasks.status]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add() {
    // List order, not tick order: the order they were suggested in reads better as bullets.
    const picked = offered.filter((item) => selected.has(item.id));
    if (picked.length === 0) return;
    // Two ideas worded alike only become one bullet - the message counts what actually lands.
    const added = newTasksForRole(role, picked.map(taskText));
    onAdd(added);
    tasks.confirm(picked);
    trackFunnelEvent("suggest_tasks_added", { count: added.length });
    showToast(`Added ${added.length} ${added.length === 1 ? "task" : "tasks"} to ${jobTitle}. Use ✦ on a bullet to reword it.`, "success");
    onClose();
  }

  const count = selected.size;

  return (
    <CanvasSheet
      title="Suggest tasks"
      placement="side"
      subtitle={
        <>
          Common tasks for <span className="font-medium text-ink">{jobTitle}</span>
          {role.company.trim() && <> at {role.company.trim()}</>}. Only tick what you actually did.
        </>
      }
      isDirty={count > 0}
      onDismiss={() => {
        trackFunnelEvent("suggest_tasks_dismissed", { hadPicks: count > 0 });
        onClose();
      }}
      footer={(requestClose) => (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={count === 0} onClick={add}>
            {count === 0 ? "Tick a task to add" : `Add ${count} ${count === 1 ? "task" : "tasks"}`}
          </Button>
        </>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4">
        {(tasks.status === "checking" || tasks.status === "loading") && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <p className="text-sm text-ink-secondary" role="status">
              {tasks.status === "loading" ? <>Finding common tasks for &ldquo;{jobTitle}&rdquo;…</> : "Checking for saved ideas…"}
            </p>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Nothing saved for this title yet: writing new ideas uses one of a free plan's goes, so
            it waits for a click - and shows how many are left before it's spent. */}
        {tasks.status === "start" && (
          <div className="flex flex-col items-start gap-4 rounded-lg bg-paper-deep p-5">
            <SparklesIcon className="h-5 w-5 text-accent" aria-hidden="true" />
            <p className="text-sm text-ink">
              We&rsquo;ll list tasks people often do as a <span className="font-medium">{jobTitle}</span>. You tick the ones you did, and
              they&rsquo;re added as bullets you can edit.
            </p>
            <Button type="button" size="sm" onClick={tasks.start}>
              Show task ideas
              <FreeUsesLeft feature="role-duties-suggest" />
            </Button>
          </div>
        )}

        {tasks.status === "error" && (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-critical/30 bg-critical-soft p-4">
            <p className="text-sm text-critical">{tasks.error ?? "Couldn't load task ideas."}</p>
            <Button type="button" variant="outline" size="sm" onClick={tasks.start}>
              Try again
            </Button>
          </div>
        )}

        {tasks.status === "limit-reached" && (
          <LimitReachedInline
            title="You've used your free task suggestions"
            message="Upgrade for unlimited task ideas on every role. You can still add bullets yourself."
          />
        )}

        {tasks.status === "ready" && (
          <div className="flex flex-col gap-3">
            {categories.length > 1 && (
              <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Filter by type of task">
                <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chipClass(category === null)}>
                  All
                </button>
                {categories.map((name) => (
                  <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className={chipClass(category === name)}>
                    {name}
                  </button>
                ))}
              </div>
            )}

            <div ref={listRef} className="flex flex-col gap-2" role="group" aria-label="Task ideas">
              {shown.length === 0 && (
                <p className="rounded-lg bg-paper-deep px-4 py-3 text-sm text-ink-secondary">
                  {offered.length === 0 && onRole.length > 0
                    ? "This role already has every task we suggested. Want more ideas?"
                    : "No ideas for this title yet. Try asking for more."}
                </p>
              )}
              {shown.map((item) => (
                <TaskRow key={item.id} item={item} checked={selected.has(item.id)} onToggle={() => toggle(item.id)} />
              ))}
              {!category &&
                onRole.map((item) => <TaskRow key={item.id} item={item} checked={false} onRole onToggle={() => {}} />)}
            </div>

            <div className="flex flex-col items-start gap-1.5 pt-1">
              <button
                type="button"
                onClick={tasks.loadMore}
                disabled={tasks.isLoadingMore}
                className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-accent-hover hover:underline underline-offset-4 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {tasks.isLoadingMore ? "Finding more ideas…" : "More ideas"}
                {!tasks.isLoadingMore && <FreeUsesLeft feature="role-duties-suggest" />}
              </button>
              {tasks.error && (
                <p role="alert" className="text-sm text-critical">
                  {tasks.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </CanvasSheet>
  );
}

function TaskRow({ item, checked, onRole = false, onToggle }: { item: RoleDutyItem; checked: boolean; onRole?: boolean; onToggle: () => void }) {
  return (
    <label
      className={clsx(
        "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm leading-snug transition-colors",
        onRole
          ? "cursor-default border-border bg-paper/60 text-ink-muted"
          : checked
          ? "cursor-pointer border-accent bg-accent-soft/40 text-ink"
          : "cursor-pointer border-border text-ink hover:border-border-strong"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={onRole}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-border-strong accent-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      />
      <span className="min-w-0 flex-1">{taskText(item)}</span>
      {onRole && (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs">
          <CheckIcon className="h-3 w-3" aria-hidden="true" /> On resume
        </span>
      )}
    </label>
  );
}
