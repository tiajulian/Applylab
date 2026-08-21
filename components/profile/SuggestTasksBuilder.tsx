"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import type { UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";

/**
 * Lets the candidate pick several job-title-typical tasks at once and adds them as tasks for the role.
 */
export function SuggestTasksBuilder({
  jobTitle,
  company,
  location,
  duties,
  existingTaskTexts = [],
  onAddTasks,
  onClose,
}: {
  jobTitle: string;
  company: string;
  location: string;
  duties: UseRoleDutiesResult;
  /** Already-used task texts - filtered out of the checkbox list */
  existingTaskTexts?: string[];
  onAddTasks: (tasks: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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

  async function handleAddTasksToRole() {
    const selectedItems = availableItems.filter((item) => selected.has(item.id));
    if (selectedItems.length === 0) return;
    setIsAdding(true);
    setAddError(null);
    const taskTexts = selectedItems.map((item) => item.user_edited_text?.trim() || item.duty_text);
    onAddTasks(taskTexts);
    try {
      await Promise.all(selectedItems.map((item) => duties.respond(item.id, "confirmed")));
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

          {duties.status !== "loading" && duties.status !== "error" && (
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
                  {visibleItems.map((item) => (
                    <div key={item.id} className="rounded border border-border bg-paper-deep/30 p-3">
                      <Checkbox
                        id={`duty-${item.id}`}
                        label={item.user_edited_text?.trim() || item.duty_text}
                        checked={selected.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                      />
                    </div>
                  ))}
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
