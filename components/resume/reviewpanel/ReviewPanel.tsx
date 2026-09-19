"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckCircleIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { bulkEligible } from "@/lib/review/apply";
import { capItems, tabItems } from "@/lib/review/engine";
import { MAX_LISTED_ITEMS, type ReviewItem } from "@/lib/review/types";
import { ReviewCard } from "./ReviewCard";

export type ReviewTab = "change" | "fix";

const TAB_LABEL: Record<ReviewTab, string> = { change: "Changes", fix: "Fixes" };
const bulkLabel = (tab: ReviewTab) => (tab === "fix" ? "Fix all" : "Accept all");
const inputTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export interface ReviewPanelProps {
  items: ReviewItem[];
  tab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  selectedId: string | null;
  isMobile: boolean;
  isPaidPlan: boolean;
  /** Section label per block id, e.g. "Experience, Analytics Engineer". */
  labels: ReadonlyMap<string, string>;
  /** Current text per block id, for the affected-words excerpt. */
  texts: ReadonlyMap<string, string>;
  canAccept: (item: ReviewItem) => boolean;
  canRevert: (item: ReviewItem) => boolean;
  hasEvidenceFlow: (item: ReviewItem) => boolean;
  onSelect: (id: string) => void;
  onAccept: (item: ReviewItem) => void;
  onEdit: (item: ReviewItem) => void;
  onDismiss: (item: ReviewItem) => void;
  onRestore: (item: ReviewItem) => void;
  onRevert: (item: ReviewItem) => void;
  onOpenEvidence: (item: ReviewItem) => void;
  /** Pro: apply many at once, after the preview. */
  onBulkApply: (tab: ReviewTab, items: ReviewItem[]) => void;
  onBulkClicked: (tab: ReviewTab, count: number) => void;
  onUpgradeClick: () => void;
  onClose: () => void;
}

/** The review side panel: docked 360px right of the preview on desktop, a full-screen sheet on phones. */
export function ReviewPanel(props: ReviewPanelProps) {
  const { items, tab, onTabChange, selectedId, isMobile, isPaidPlan, labels, texts } = props;
  const rootRef = useRef<HTMLElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  const pendingFocus = useRef<{ id: string | null } | null>(null);
  const [limit, setLimit] = useState(MAX_LISTED_ITEMS);
  const [showDismissed, setShowDismissed] = useState(false);
  const [bulk, setBulk] = useState<{ tab: ReviewTab; skipped: Set<string> } | null>(null);

  // Focus moves into the panel on open; ResumeEditor returns it to the chip on close.
  useEffect(() => rootRef.current?.focus(), []);

  const counts = { change: tabItems(items, "change").length, fix: tabItems(items, "fix").length };
  const open = useMemo(() => tabItems(items, tab), [items, tab]);
  const dismissed = useMemo(() => tabItems(items, tab, "dismissed"), [items, tab]);
  const { shown, hidden } = capItems(open, limit);
  const eligible = useMemo(() => bulkEligible(items, tab), [items, tab]);

  useEffect(() => {
    if (selectedId) cardRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId, tab]);

  // After an action removes the focused card, put focus back on the next one so J/K keep working.
  useEffect(() => {
    if (!pendingFocus.current) return;
    const { id } = pendingFocus.current;
    pendingFocus.current = null;
    ((id ? cardRefs.current.get(id) : null) ?? rootRef.current)?.focus({ preventScroll: true });
  }, [items]);

  function neighbour(item: ReviewItem): string | null {
    const i = shown.findIndex((x) => x.id === item.id);
    return (shown[i + 1] ?? shown[i - 1])?.id ?? null;
  }

  /** Runs an action that removes the card from the open list, then selects and focuses the next card. */
  function thenAdvance(item: ReviewItem, action: (item: ReviewItem) => void) {
    const next = neighbour(item);
    action(item);
    pendingFocus.current = { id: next };
    if (next) props.onSelect(next);
  }

  function move(delta: 1 | -1) {
    if (shown.length === 0) return;
    const i = shown.findIndex((x) => x.id === selectedId);
    const next = shown[Math.min(shown.length - 1, Math.max(0, i === -1 ? 0 : i + delta))];
    props.onSelect(next.id);
    cardRefs.current.get(next.id)?.focus({ preventScroll: true });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (bulk) setBulk(null);
      else props.onClose();
      return;
    }
    const target = e.target as HTMLElement;
    if (bulk || e.metaKey || e.ctrlKey || e.altKey || inputTags.has(target.tagName)) return;
    const current = shown.find((x) => x.id === selectedId);
    switch (e.key.toLowerCase()) {
      case "j":
        return move(1);
      case "k":
        return move(-1);
      case "enter":
        // Only when the card itself has focus, so Enter on a button still just presses that button.
        if (current && target.hasAttribute("data-review-card") && props.canAccept(current)) {
          e.preventDefault();
          thenAdvance(current, props.onAccept);
        }
        return;
      case "e":
        if (current) props.onEdit(current);
        return;
      case "d":
        if (current) thenAdvance(current, props.onDismiss);
        return;
    }
  }

  const totalOpen = counts.change + counts.fix;
  const bulkItems = bulk ? bulkEligible(items, bulk.tab).filter((i) => !bulk.skipped.has(i.id)) : [];

  return (
    <aside
      ref={rootRef}
      id="review-panel"
      role="dialog"
      aria-label="Review"
      aria-modal={isMobile ? true : undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={
        isMobile
          ? "fixed inset-0 z-40 flex flex-col bg-surface focus:outline-none"
          : "relative flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-surface focus:outline-none"
      }
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="font-display text-base text-ink">
          Review <span className="ml-1 text-sm font-medium text-ink-secondary">{totalOpen} open</span>
        </h2>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close review panel"
          className="flex h-8 w-8 items-center justify-center rounded text-ink-secondary hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </header>

      <div role="tablist" aria-label="Review categories" className="flex gap-1 border-b border-border px-3 pt-2">
        {(["change", "fix"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`review-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="review-tabpanel"
            onClick={() => {
              onTabChange(t);
              setShowDismissed(false);
            }}
            className={`-mb-px rounded-t border-b-2 px-3 py-1.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === t ? "border-accent text-ink" : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            {TAB_LABEL[t]} <span className="text-xs font-medium">({counts[t]})</span>
          </button>
        ))}
      </div>

      <div id="review-tabpanel" role="tabpanel" aria-labelledby={`review-tab-${tab}`} className="flex min-h-0 flex-1 flex-col">
        {eligible.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <span className="text-xs text-ink-secondary">
              {eligible.length} can be done at once{tab === "change" ? " (reworded only)" : ""}
            </span>
            {isPaidPlan ? (
              <button
                type="button"
                onClick={() => {
                  props.onBulkClicked(tab, eligible.length);
                  setBulk({ tab, skipped: new Set() });
                }}
                className="rounded border border-accent bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bulkLabel(tab)}
              </button>
            ) : (
              <a
                href="/upgrade"
                onClick={props.onUpgradeClick}
                className="rounded border border-border bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bulkLabel(tab)} (Pro)
              </a>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {totalOpen === 0 && (
            <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm font-medium text-success">
              <CheckCircleIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> All clear, nothing left to review.
            </p>
          )}
          {totalOpen > 0 && open.length === 0 && <p className="px-1 text-sm text-ink-secondary">Nothing open in {TAB_LABEL[tab]}.</p>}

          <ul className="flex flex-col gap-2">
            {(showDismissed ? dismissed : shown).map((item) => (
              <ReviewCard
                key={item.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(item.id, el);
                  else cardRefs.current.delete(item.id);
                }}
                item={item}
                label={labels.get(item.blockId) ?? ""}
                text={texts.get(item.blockId) ?? ""}
                selected={item.id === selectedId}
                canAccept={props.canAccept(item)}
                canRevert={props.canRevert(item)}
                onSelect={() => props.onSelect(item.id)}
                onAccept={() => thenAdvance(item, props.onAccept)}
                onEdit={() => props.onEdit(item)}
                onDismiss={() => thenAdvance(item, props.onDismiss)}
                onRevert={() => thenAdvance(item, props.onRevert)}
                onRestore={() => props.onRestore(item)}
                onOpenEvidence={props.hasEvidenceFlow(item) ? () => props.onOpenEvidence(item) : undefined}
              />
            ))}
          </ul>

          {!showDismissed && hidden > 0 && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + MAX_LISTED_ITEMS)}
              className="mt-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Show more ({hidden} more)
            </button>
          )}
        </div>

        {(dismissed.length > 0 || showDismissed) && (
          <footer className="border-t border-border px-4 py-2">
            <button
              type="button"
              aria-expanded={showDismissed}
              onClick={() => setShowDismissed((v) => !v)}
              className="text-xs font-semibold text-ink-secondary underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showDismissed ? `Back to ${TAB_LABEL[tab]}` : `Dismissed (${dismissed.length})`}
            </button>
          </footer>
        )}
      </div>

      {bulk && (
        <div className="absolute inset-0 z-10 flex flex-col bg-surface" role="group" aria-label={`${bulkLabel(bulk.tab)} preview`}>
          <header className="border-b border-border px-4 py-3">
            <h3 className="font-display text-base text-ink">{bulkLabel(bulk.tab)}: preview</h3>
            <p className="text-xs text-ink-secondary">
              {bulk.tab === "change" ? "Reworded changes only. New claims are never included." : "Spelling fixes only."} Skip any you want to keep as they are.
            </p>
          </header>
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {bulkEligible(items, bulk.tab).map((item) => {
              const skipped = bulk.skipped.has(item.id);
              return (
                <li key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm text-ink">
                  <span className={skipped ? "text-ink-secondary line-through" : undefined}>
                    <span className="block text-xs font-semibold text-ink-secondary">{labels.get(item.blockId)}</span>
                    {item.kind === "fix" ? `${item.before} → ${item.after}` : item.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setBulk((b) => {
                        if (!b) return b;
                        const skippedNext = new Set(b.skipped);
                        if (skippedNext.has(item.id)) skippedNext.delete(item.id);
                        else skippedNext.add(item.id);
                        return { ...b, skipped: skippedNext };
                      })
                    }
                    className="shrink-0 rounded border border-border bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {skipped ? "Include" : "Skip"}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setBulk(null)}
              className="rounded border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkItems.length === 0}
              onClick={() => {
                props.onBulkApply(bulk.tab, bulkItems);
                setBulk(null);
              }}
              className="rounded border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Apply {bulkItems.length}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
