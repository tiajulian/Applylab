"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ChipPicker } from "@/components/profile/ChipPicker";
import { LimitReachedInline } from "@/components/upgrade/LimitReachedInline";
import { patchDutyItem, type UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";

/**
 * Lets the candidate pick several job-title-typical tasks at once and adds them as tasks for the role.
 */
export function SuggestTasksBuilder({
  jobTitle,
  company,
  location,
  duties,
  existingTaskTexts = [],
  profileTools,
  onAddProfileTool,
  onAddTasks,
  onClose,
}: {
  jobTitle: string;
  company: string;
  location: string;
  duties: UseRoleDutiesResult;
  /** Already-used task texts - filtered out of the checkbox list */
  existingTaskTexts?: string[];
  profileTools: string[];
  onAddProfileTool: (tool: string) => void;
  onAddTasks: (tasks: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Per-item tool picks, keyed by duty item id - undefined until touched, in which case the
  // item's own persisted `tools` (from a previous visit) is the effective value.
  const [toolsByItem, setToolsByItem] = useState<Record<string, string[]>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    // Deliberately unconditional on duties.status (not just "idle"/"hidden") - handleSuggest
    // always resolves to a correct state regardless of what it was called during, whereas gating
    // on "not currently loading" can race the card's own background prefetch (the mount-time
    // full=1 check in useRoleDuties.ts): if that GET is still in flight when this modal opens,
    // status reads "loading" for a moment, this effect's one-shot guard trips anyway, and no
    // fetch ever happens for this mount - an empty, permanently-stuck modal.
    if (duties.items.length === 0) {
      duties.handleSuggest(company, location);
    }
    // Only ever runs once on mount - opening this modal is the one "Suggest tasks" action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ref-mirrored (not read directly in the Escape handler below) so the listener can bind once on
  // mount instead of re-subscribing on every step/drafts change, same pattern as WinBuilder.tsx.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function requestClose() {
    onCloseRef.current();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableItems = duties.items.filter(
    (item) =>
      item.user_state === "pending" &&
      !existingTaskTexts.includes(item.user_edited_text?.trim() || item.duty_text)
  );
  const categories = Array.from(
    new Set(availableItems.map((item) => item.category).filter((c): c is string => Boolean(c)))
  );
  const visibleItems = activeCategory ? availableItems.filter((item) => item.category === activeCategory) : availableItems;

  function toggleItem(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toolsFor(item: (typeof availableItems)[number]): string[] {
    return toolsByItem[item.id] ?? item.tools ?? [];
  }

  function toggleTool(itemId: string, current: string[], tool: string) {
    setToolsByItem((prev) => ({
      ...prev,
      [itemId]: current.includes(tool) ? current.filter((t) => t !== tool) : [...current, tool],
    }));
  }

  function addNewTool(itemId: string, current: string[], tool: string) {
    onAddProfileTool(tool);
    setToolsByItem((prev) => ({ ...prev, [itemId]: current.includes(tool) ? current : [...current, tool] }));
  }

  // Matches the server's own MAX_DUTY_TEXTS cap (app/api/role-duties/generate-achievements/
  // route.ts) - kept in sync here so a selection over the cap degrades predictably (the overflow
  // items fall back to their plain suggested text, same as a failed/limited request would) rather
  // than silently misaligning results against the wrong items.
  const MAX_POLISH_BATCH = 8;

  async function handleAddTasksToRole() {
    const selectedItems = availableItems.filter((item) => selected.has(item.id));
    if (selectedItems.length === 0 || !duties.suggestion) return;
    setIsAdding(true);
    setAddError(null);

    const baseTexts = selectedItems.map((item) => item.user_edited_text?.trim() || item.duty_text);
    const itemTools = selectedItems.map((item) => toolsFor(item));
    // Only tasks with tools tagged are worth an AI rewrite - a plain suggested task is already
    // resume-ready text, so paraphrasing it would just spend an API call for no reader-visible
    // change. Untagged tasks are added exactly as suggested, at zero cost.
    const needsPolishAt = selectedItems
      .map((_, index) => index)
      .filter((index) => itemTools[index].length > 0)
      .slice(0, MAX_POLISH_BATCH);

    const taskTexts = [...baseTexts];

    async function fetchPolishedTexts() {
      if (needsPolishAt.length === 0) return;
      try {
        const response = await fetch("/api/role-duties/generate-achievements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dutyTexts: needsPolishAt.map((index) => baseTexts[index]),
            toolsByIndex: needsPolishAt.map((index) => itemTools[index]),
            jobTitle,
            company,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const achievements: { index: number; text: string }[] = data.achievements ?? [];
          // `index` is the position within needsPolishAt's own request array, not selectedItems -
          // map back through needsPolishAt to land each result on the right task. Anything not
          // returned (a single duty's generation can fail independently, or the free-tier limit
          // was hit) just keeps its plain suggested text - tagging tools always succeeds, the AI
          // rewrite is a best-effort upgrade on top, never a blocker to adding the task.
          for (const achievement of achievements) {
            const targetIndex = needsPolishAt[achievement.index];
            if (targetIndex !== undefined) taskTexts[targetIndex] = achievement.text;
          }
        }
      } catch {
        // Network failure - fall through with plain suggested text for the tools-tagged tasks,
        // same as any other failure mode above.
      }
    }

    async function confirmSelectedItems() {
      await Promise.all(
        selectedItems.map(async (item, index) => {
          const updated = await patchDutyItem(duties.suggestion!.id, item.id, {
            user_state: "confirmed",
            tools: itemTools[index],
          });
          if (updated) duties.updateItem(updated);
        })
      );
    }

    try {
      // The AI rewrite (slow) and the confirm+tools DB writes (fast, and independent of the
      // rewrite's outcome) run concurrently rather than one after the other.
      await Promise.all([fetchPolishedTexts(), confirmSelectedItems()]);

      onAddTasks(taskTexts);

      // Sync duty_text identity for any task the rewrite actually changed - otherwise
      // RoleContentList's text-match lookup (the "Add to Key skills" chips, and passing tools into
      // Win Builder if this task is opened again) compares the new sentence against the untouched
      // original duty_text and silently finds nothing, exactly for the tasks the AI rewrite
      // succeeded on.
      const rewrittenAt = needsPolishAt.filter((index) => taskTexts[index] !== baseTexts[index]);
      if (rewrittenAt.length > 0) {
        await Promise.all(
          rewrittenAt.map(async (index) => {
            const updated = await patchDutyItem(duties.suggestion!.id, selectedItems[index].id, {
              user_edited_text: taskTexts[index],
            });
            if (updated) duties.updateItem(updated);
          })
        );
      }
    } catch (err: unknown) {
      console.warn("Failed to record confirmed duties", err);
    } finally {
      setIsAdding(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={requestClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Suggest tasks for this role"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-y-auto rounded-lg bg-surface p-6 shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={requestClose}
        >
          ✕
        </button>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-h3 text-ink">Suggested tasks for this role</h2>
            <p className="mt-1 text-sm text-ink-secondary">Based on your role and industry. Select only the tasks you actually did.</p>
          </div>

          {duties.status === "loading" && <p className="text-sm text-ink-secondary">Looking up typical tasks for &ldquo;{jobTitle}&rdquo;…</p>}

          {duties.status === "error" && (
            <div className="flex flex-col gap-2 rounded border border-critical/30 bg-critical/5 p-3">
              <p className="text-sm text-critical">{duties.error ?? "Couldn't load suggestions."}</p>
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => duties.handleSuggest(company, location)}>
                Try again
              </Button>
            </div>
          )}

          {duties.status === "limit-reached" && (
            <LimitReachedInline
              title="You've used your free duty suggestions"
              message="Upgrade for unlimited AI duty suggestions on every role."
            />
          )}

          {duties.status !== "loading" && duties.status !== "error" && duties.status !== "limit-reached" && (
            <>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className={clsx(
                      "min-h-9 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors duration-fast ease-editorial",
                      activeCategory === null
                        ? "border-accent bg-accent text-on-accent"
                        : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                    )}
                  >
                    All tasks
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={clsx(
                        "min-h-9 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors duration-fast ease-editorial",
                        activeCategory === category
                          ? "border-accent bg-accent text-on-accent"
                          : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}

              {visibleItems.length === 0 ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-ink-secondary">
                    {duties.items.length > 0
                      ? "You've already used every suggested task for this title."
                      : "No suggestions found for this title."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => duties.handleSuggest(company, location, true)}
                  >
                    Get more suggestions
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {visibleItems.map((item) => {
                    const itemTools = toolsFor(item);
                    return (
                      <div key={item.id} className="rounded border border-border bg-paper-deep/30 p-3">
                        <Checkbox
                          id={`duty-${item.id}`}
                          label={item.user_edited_text?.trim() || item.duty_text}
                          checked={selected.has(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                        <div className="mt-2 pl-7">
                          <p className="mb-1.5 text-xs font-medium text-ink-secondary">Tools used (optional)</p>
                          <ChipPicker
                            options={profileTools}
                            selected={itemTools}
                            onToggle={(tool) => toggleTool(item.id, itemTools, tool)}
                            onAddNew={(tool) => addNewTool(item.id, itemTools, tool)}
                            addPlaceholder="Add a tool (e.g. Snowflake, Tableau)"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {addError && <p className="text-sm text-critical">{addError}</p>}

              <div className="mt-2 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-secondary">{selected.size} selected</p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="md" onClick={requestClose}>
                    Cancel
                  </Button>
                  <Button type="button" size="md" isLoading={isAdding} disabled={selected.size === 0} onClick={handleAddTasksToRole}>
                    Add {selected.size} task{selected.size === 1 ? "" : "s"} to this role
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
