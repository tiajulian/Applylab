"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import type { UseRoleDutiesResult } from "@/lib/profile/useRoleDuties";
import type { WorkExperienceWin } from "@/types";

const MAX_ACHIEVEMENT_LENGTH = 300;

interface Draft {
  /** Source task text this draft came from, or "" for a hand-typed addition (see
   * "+ Add another achievement") - kept so "Regenerate" and the confirm-on-add step below can
   * trace a draft back to its role_duty_items row. */
  dutyText: string;
  text: string;
}

async function requestAchievements(
  dutyTexts: string[],
  jobTitle: string,
  company: string
): Promise<{ achievements: { dutyText: string; text: string }[]; failedCount: number } | { error: string }> {
  const response = await fetch("/api/role-duties/generate-achievements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dutyTexts, jobTitle, company }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { error: data.error ?? "Something went wrong. Please try again." };
  return { achievements: data.achievements ?? [], failedCount: data.failedCount ?? 0 };
}

/**
 * Manual-role counterpart to WinBuilder.tsx: instead of asking/slotting one win at a time, lets
 * the candidate pick several job-title-typical tasks at once and turns each into a draft
 * achievement bullet. "Generate"/"Regenerate" only ever rephrase a task the candidate already
 * confirmed they did into resume-bullet grammar (see BULLETIFY_INSTRUCTION in
 * lib/anthropic/assistBullet.ts) - same "never invent the achievement" discipline as WinBuilder,
 * just applied to several tasks in one pass instead of one guided walkthrough.
 *
 * Reuses the same `duties` state (useRoleDuties) already threaded through RoleContentList for
 * the extracted-role "Ideas from this role" flow, rather than a second suggestion mechanism -
 * opening this modal is itself the "Suggest tasks" action, so it triggers the fetch on mount if
 * nothing's loaded yet.
 */
export function SuggestTasksBuilder({
  jobTitle,
  company,
  location,
  duties,
  existingWinWhats,
  onAddWins,
  onClose,
}: {
  jobTitle: string;
  company: string;
  location: string;
  duties: UseRoleDutiesResult;
  /** Already-used task texts (win.what for every existing win) - filtered out of the checkbox
   * list so re-opening this modal doesn't offer a task the candidate already turned into an
   * achievement. */
  existingWinWhats: string[];
  onAddWins: (wins: WorkExperienceWin[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"select" | "review">("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
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
  const stepRef = useRef(step);
  stepRef.current = step;
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Only the "review" step can hold anything worth losing - generated/edited achievement text
  // not yet added to the role. The "select" step is just checkboxes over re-fetchable
  // suggestions, so closing from there is always lossless.
  function requestClose() {
    if (stepRef.current === "review" && draftsRef.current.some((d) => d.text.trim())) {
      setShowDiscardConfirm(true);
    } else {
      onCloseRef.current();
    }
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
      !existingWinWhats.includes(item.user_edited_text?.trim() || item.duty_text)
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

  function failureNotice(failedCount: number): string | null {
    if (!failedCount) return null;
    return `${failedCount} task${failedCount === 1 ? "" : "s"} couldn't be turned into an achievement - try Regenerate, or write it yourself.`;
  }

  async function handleGenerate() {
    const selectedItems = availableItems.filter((item) => selected.has(item.id));
    if (selectedItems.length === 0) return;
    setIsGenerating(true);
    setGenerateError(null);
    const dutyTexts = selectedItems.map((item) => item.user_edited_text?.trim() || item.duty_text);
    const result = await requestAchievements(dutyTexts, jobTitle, company);
    setIsGenerating(false);
    if ("error" in result) {
      setGenerateError(result.error);
      return;
    }
    setDrafts(result.achievements);
    setGenerateError(failureNotice(result.failedCount));
    setStep("review");
  }

  // Only re-sends drafts that came from a suggested task (dutyText set) - a hand-typed draft (see
  // addBlankDraft) has no dutyText, so it's never included in the request and is left untouched
  // by the merge-by-dutyText below, instead of being wiped out by a full-array replace.
  async function regenerateAll() {
    const regenerable = drafts.filter((d) => d.dutyText);
    if (regenerable.length === 0 || regeneratingIndex !== null) return;
    setIsGenerating(true);
    setGenerateError(null);
    const result = await requestAchievements(
      regenerable.map((d) => d.dutyText),
      jobTitle,
      company
    );
    setIsGenerating(false);
    if ("error" in result) {
      setGenerateError(result.error);
      return;
    }
    const byDutyText = new Map(result.achievements.map((a) => [a.dutyText, a.text]));
    setDrafts((current) => current.map((d) => (d.dutyText && byDutyText.has(d.dutyText) ? { ...d, text: byDutyText.get(d.dutyText)! } : d)));
    setGenerateError(failureNotice(result.failedCount));
  }

  async function regenerateOne(index: number) {
    if (isGenerating) return;
    const draft = drafts[index];
    if (!draft || !draft.dutyText) return;
    setRegeneratingIndex(index);
    setGenerateError(null);
    const result = await requestAchievements([draft.dutyText], jobTitle, company);
    setRegeneratingIndex(null);
    if ("error" in result) {
      setGenerateError(result.error);
      return;
    }
    const next = result.achievements[0];
    if (!next) return;
    setDrafts((current) => current.map((d, i) => (i === index ? next : d)));
  }

  function updateDraftText(index: number, text: string) {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, text } : d)));
  }

  function removeDraft(index: number) {
    setDrafts((current) => current.filter((_, i) => i !== index));
  }

  function addBlankDraft() {
    setDrafts((current) => [...current, { dutyText: "", text: "" }]);
  }

  async function handleAddToRole() {
    const finalDrafts = drafts.filter((d) => d.text.trim());
    if (finalDrafts.length === 0) return;
    setIsAdding(true);
    const wins: WorkExperienceWin[] = finalDrafts.map((d) => ({
      text: d.text.trim(),
      metric: "",
      ...(d.dutyText ? { what: d.dutyText } : {}),
    }));
    onAddWins(wins);
    // Marks the underlying suggestions used - keeps them out of this list next time it's
    // reopened, same confirm path RoleDutiesReview's "I did this" already uses.
    const usedItems = availableItems.filter((item) =>
      finalDrafts.some((d) => d.dutyText && d.dutyText === (item.user_edited_text?.trim() || item.duty_text))
    );
    await Promise.all(usedItems.map((item) => duties.respond(item.id, "confirmed")));
    setIsAdding(false);
    onClose();
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

        {step === "select" && (
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

                {generateError && <p className="text-sm text-critical">{generateError}</p>}

                <div className="mt-2 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink-secondary">{selected.size} selected</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="md" onClick={requestClose}>
                      Cancel
                    </Button>
                    <Button type="button" size="md" isLoading={isGenerating} disabled={selected.size === 0} onClick={handleGenerate}>
                      Generate achievements
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-h3 text-ink">Review your achievements</h2>
                <p className="mt-1 text-sm text-ink-secondary">Review and edit before adding them to your resume.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isGenerating}
                disabled={regeneratingIndex !== null}
                onClick={regenerateAll}
              >
                Regenerate all
              </Button>
            </div>

            {generateError && <p className="text-sm text-critical">{generateError}</p>}

            <div className="flex flex-col gap-3">
              {drafts.map((draft, index) => (
                <div key={index} className="flex gap-3 rounded border border-border bg-paper-deep/30 p-3">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-xs font-semibold text-accent">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Textarea
                      rows={2}
                      maxLength={MAX_ACHIEVEMENT_LENGTH}
                      value={draft.text}
                      onChange={(e) => updateDraftText(index, e.target.value)}
                    />
                    <p className="text-xs text-ink-muted">
                      {draft.text.length} / {MAX_ACHIEVEMENT_LENGTH}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-sm text-xs font-medium text-accent underline transition-colors duration-fast ease-editorial hover:text-accent/70 disabled:opacity-50"
                      disabled={!draft.dutyText || regeneratingIndex === index || isGenerating}
                      onClick={() => regenerateOne(index)}
                    >
                      {regeneratingIndex === index ? "Regenerating…" : "Regenerate"}
                    </button>
                    <button
                      type="button"
                      aria-label="Remove achievement"
                      className="flex h-6 w-6 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink"
                      onClick={() => removeDraft(index)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={addBlankDraft}>
              + Add another achievement
            </Button>

            <p className="rounded bg-paper-deep/40 p-3 text-xs text-ink-muted">
              These will appear as bullet points under <span className="font-medium text-ink-secondary">{jobTitle}</span>
              {company && (
                <>
                  {" "}
                  at <span className="font-medium text-ink-secondary">{company}</span>
                </>
              )}{" "}
              on your resume.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" size="md" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                isLoading={isAdding}
                disabled={drafts.filter((d) => d.text.trim()).length === 0}
                onClick={handleAddToRole}
              >
                Add {drafts.filter((d) => d.text.trim()).length} achievement
                {drafts.filter((d) => d.text.trim()).length === 1 ? "" : "s"} to this role
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {showDiscardConfirm && (
        <ConfirmDialog
          title="Discard these achievements?"
          description="Your generated and edited achievements won't be saved."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          isDestructive
          onConfirm={() => {
            setShowDiscardConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
}
