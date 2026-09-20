"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CheckCircleIcon, InfoIcon, LockIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { bulkCandidates, nextToReview, reviewProgress, type ReviewEntry } from "@/lib/review/progress";
import type { ReviewItem, ReviewKind } from "@/lib/review/types";
import { ReviewCard } from "./ReviewCard";

export type ReviewTab = ReviewKind;

const TAB_LABEL: Record<ReviewTab, string> = { change: "Rewrites", fix: "Fixes" };
const inputTags = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

export interface ReviewPanelProps {
  entries: ReviewEntry[];
  tab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  selectedId: string | null;
  isMobile: boolean;
  isPaidPlan: boolean;
  /** Section label per block id, e.g. "Experience, Analytics Engineer". */
  labels: ReadonlyMap<string, string>;
  /** Current text per block id. */
  texts: ReadonlyMap<string, string>;
  canAccept: (item: ReviewItem) => boolean;
  /** Whether "Keep original" / "Dismiss" has something to do. */
  canKeep: (item: ReviewItem) => boolean;
  hasEvidenceFlow: (item: ReviewItem) => boolean;
  onSelect: (id: string) => void;
  /** Accept / Save-and-accept / Keep report whether they went through, so the panel never says "Accepted" for a no-op. */
  onAccept: (item: ReviewItem) => boolean;
  onKeep: (item: ReviewItem) => boolean;
  onSaveEdit: (item: ReviewItem, text: string) => boolean;
  onUndo: (entry: ReviewEntry) => void;
  onOpenEvidence: (item: ReviewItem) => void;
  /** Pro: accept every rewrite that added no new facts, in one step. */
  onBulkApply: (items: ReviewItem[]) => void;
  onBulkClicked: (count: number) => void;
  onUpgradeClick: () => void;
  onClose: () => void;
}

/**
 * The review side panel: docked 420px right of the preview on desktop, a full-screen sheet on phones.
 * One card is open at a time; deciding on it opens the next. Nothing reaches the resume until Accept,
 * and every decision has an Undo instead of a confirmation.
 */
export function ReviewPanel(props: ReviewPanelProps) {
  const { entries, tab, onTabChange, selectedId, isMobile, isPaidPlan, labels, texts } = props;
  const rootRef = useRef<HTMLElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());
  /** Set by an action, so focus follows the newly opened card once it has rendered (the button pressed is gone). */
  const refocus = useRef(false);
  /** An undone fix comes back only after the re-check; until then no other card should take its place. */
  const reopenId = useRef<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const selected = entries.find((e) => e.state === "pending" && e.item.id === selectedId);
    return (selected ?? entries.find((e) => e.state === "pending" && e.item.kind === tab))?.item.id ?? null;
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [lastAction, setLastAction] = useState("");

  const progress = reviewProgress(entries);
  const pending = progress.total - progress.reviewed;
  const remaining = (kind: ReviewTab) => entries.filter((e) => e.state === "pending" && e.item.kind === kind).length;
  const bulk = useMemo(() => bulkCandidates(entries), [entries]);

  // Open work first (as decided, then put-off), finished rows below, so a card never jumps under the pointer.
  const tabEntries = useMemo(() => entries.filter((e) => e.item.kind === tab), [entries, tab]);
  const listed = useMemo(() => {
    const rank = (e: ReviewEntry) => (e.state !== "pending" ? 2 : skipped.has(e.item.id) ? 1 : 0);
    return [...tabEntries].sort((a, b) => rank(a) - rank(b));
  }, [tabEntries, skipped]);
  const placeOf = useMemo(() => new Map(tabEntries.map((e, i) => [e.item.id, i + 1])), [tabEntries]);
  const openEntry = tabEntries.find((e) => e.state === "pending" && e.item.id === expandedId) ?? null;

  useEffect(() => rootRef.current?.focus(), []);

  // Show the preview highlight for the card the panel opened on.
  useEffect(() => {
    if (expandedId && expandedId !== selectedId) props.onSelect(expandedId);
    // Once, on open: later changes go through open().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A click on a highlight in the resume opens its card.
  useEffect(() => {
    if (selectedId && entries.some((e) => e.state === "pending" && e.item.id === selectedId)) setExpandedId(selectedId);
    // Only a change of selection: entries changing must not reopen what the person just closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Keep a card open in the visible tab: after a tab switch, an undo, or an item that has left the list.
  useEffect(() => {
    if (openEntry) return;
    const wanted = reopenId.current && entries.find((e) => e.state === "pending" && e.item.id === reopenId.current);
    if (wanted) return open(wanted.item.id);
    if (reopenId.current) return;
    const next = nextToReview(entries, skipped, tab);
    if (next?.kind === tab) open(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntry, entries, tab, skipped]);

  useEffect(() => {
    if (!refocus.current) return;
    const card = expandedId ? cardRefs.current.get(expandedId) : null;
    const target = card ?? rootRef.current;
    target?.focus({ preventScroll: true });
    if (document.activeElement === target) refocus.current = false;
    card?.scrollIntoView({ block: "nearest" });
  }, [expandedId, editingId, entries]);

  function open(id: string) {
    reopenId.current = null;
    setExpandedId(id);
    setEditingId(null);
    props.onSelect(id);
  }

  /** Opens the next card to review, in this tab first and the other tab once this one is finished. */
  function advance(from: ReviewItem, nowSkipped: ReadonlySet<string> = skipped) {
    refocus.current = true;
    const next = nextToReview(entries, nowSkipped, from.kind, from.id);
    if (next) open(next.id);
    else {
      setExpandedId(null);
      setEditingId(null);
    }
  }

  function decide(item: ReviewItem, verb: string, action: (item: ReviewItem) => boolean) {
    if (!action(item)) return;
    setLastAction(verb);
    advance(item);
  }

  function skip(item: ReviewItem) {
    const next = new Set(skipped).add(item.id);
    setSkipped(next);
    setLastAction("Skipped for later");
    advance(item, next);
  }

  function undo(entry: ReviewEntry) {
    props.onUndo(entry);
    setSkipped((prev) => {
      const next = new Set(prev);
      next.delete(entry.item.id);
      return next;
    });
    setLastAction("Undone");
    refocus.current = true;
    open(entry.item.id);
    reopenId.current = entry.item.id;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      props.onClose();
      return;
    }
    const target = e.target as HTMLElement;
    if (!openEntry || editingId || e.metaKey || e.ctrlKey || e.altKey || inputTags.has(target.tagName)) return;
    const { item } = openEntry;
    switch (e.key.toLowerCase()) {
      case "a":
        if (props.canAccept(item)) decide(item, "Accepted", props.onAccept);
        return;
      case "k":
        if (props.canKeep(item)) decide(item, "Kept original", props.onKeep);
        return;
      case "e":
        e.preventDefault();
        setEditingId(item.id);
        return;
      case "s":
        skip(item);
        return;
    }
  }

  const tabButton = (t: ReviewTab) => (
    <button
      key={t}
      type="button"
      aria-pressed={tab === t}
      onClick={() => {
        reopenId.current = null;
        onTabChange(t);
      }}
      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${focusRing} ${
        tab === t ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
      }`}
    >
      {TAB_LABEL[t]}
      <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${tab === t ? "bg-paper-deep text-ink" : "bg-border/60 text-ink-secondary"}`}>
        {remaining(t)}<span className="sr-only"> left</span>
      </span>
    </button>
  );

  return (
    <aside
      ref={rootRef}
      id="review-panel"
      role="dialog"
      aria-labelledby="review-panel-title"
      aria-modal={isMobile ? true : undefined}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={
        isMobile
          ? "fixed inset-0 z-40 flex flex-col bg-paper focus:outline-none"
          : "relative flex h-full w-[420px] max-w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-paper focus:outline-none"
      }
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div>
          <h2 id="review-panel-title" className="font-display text-2xl leading-tight text-ink">Review suggestions</h2>
          <p className="mt-1 text-sm text-ink-secondary">Nothing changes on your resume until you accept.</p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close review panel"
          className={`-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-secondary hover:bg-paper-deep hover:text-ink ${focusRing}`}
        >
          <XIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <div className="shrink-0 px-4 pb-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-ink">{progress.reviewed} of {progress.total} reviewed</span>
          {progress.verify > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-attention">
              <InfoIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              {progress.verify} to verify
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Suggestions reviewed"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.reviewed}
          className="h-2 overflow-hidden rounded-pill bg-border"
        >
          <div
            className={`h-full rounded-pill transition-[width] duration-slow ease-editorial motion-reduce:transition-none ${pending === 0 ? "bg-success" : "bg-amber-600"}`}
            style={{ width: `${progress.total === 0 ? 0 : (progress.reviewed / progress.total) * 100}%` }}
          />
        </div>
      </div>

      <div role="group" aria-label="Suggestion type" className="mx-4 mb-3 flex shrink-0 gap-1 rounded-xl bg-paper-deep p-1">
        {(["change", "fix"] as const).map(tabButton)}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto border-t border-border px-4 py-3">
        {progress.total === 0 && <p className="text-sm text-ink-secondary">Nothing to review. Your resume has no open suggestions.</p>}

        {progress.total > 0 && pending === 0 && (
          <section aria-label="All caught up" className="flex shrink-0 flex-col gap-3 rounded-xl border border-success/30 bg-success-soft p-4">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-success" strokeWidth={2} aria-hidden="true" />
              <div>
                <h3 className="font-display text-lg text-ink">All caught up</h3>
                <p className="text-sm text-ink-secondary">{progress.accepted} accepted, {progress.kept} kept as original</p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border border-accent bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover ${focusRing}`}
            >
              Back to my resume
            </button>
          </section>
        )}

        {tab === "change" && bulk.length > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
            <p className="text-sm text-ink">
              {bulk.length === 1 ? "1 rewrite keeps" : `${bulk.length} rewrites keep`} all your facts unchanged.
            </p>
            {isPaidPlan ? (
              <button
                type="button"
                onClick={() => {
                  props.onBulkClicked(bulk.length);
                  props.onBulkApply(bulk);
                  refocus.current = true;
                  setLastAction(`Accepted ${bulk.length}`);
                }}
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-paper-deep ${focusRing}`}
              >
                Accept {bulk.length}
              </button>
            ) : (
              <a
                href="/upgrade"
                onClick={props.onUpgradeClick}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-paper-deep ${focusRing}`}
              >
                Accept {bulk.length}
                <span className="inline-flex items-center gap-1 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                  <LockIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                  PRO<span className="sr-only"> feature, upgrade to use</span>
                </span>
              </a>
            )}
          </div>
        )}

        {progress.total > 0 && tabEntries.length === 0 && (
          <p className="text-sm text-ink-secondary">No {TAB_LABEL[tab].toLowerCase()} to review.</p>
        )}

        <ul className="flex flex-col gap-2">
          {listed.map((entry) => {
            const { item } = entry;
            return (
              <ReviewCard
                key={item.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(item.id, el);
                  else cardRefs.current.delete(item.id);
                }}
                entry={entry}
                label={labels.get(item.blockId) ?? ""}
                blockText={texts.get(item.blockId) ?? ""}
                expanded={entry.state === "pending" && item.id === openEntry?.item.id}
                editing={editingId === item.id}
                skipped={skipped.has(item.id)}
                place={{ index: placeOf.get(item.id) ?? 0, count: tabEntries.length }}
                canAccept={props.canAccept(item)}
                canKeep={props.canKeep(item)}
                onExpand={() => {
                  refocus.current = true;
                  open(item.id);
                }}
                onAccept={() => decide(item, "Accepted", props.onAccept)}
                onKeep={() => decide(item, "Kept original", props.onKeep)}
                onSkip={() => skip(item)}
                onStartEdit={() => setEditingId(item.id)}
                onCancelEdit={() => {
                  refocus.current = true;
                  setEditingId(null);
                }}
                onSaveEdit={(text) => decide(item, "Saved and accepted", (i) => props.onSaveEdit(i, text))}
                onUndo={() => undo(entry)}
                onOpenEvidence={props.hasEvidenceFlow(item) ? () => props.onOpenEvidence(item) : undefined}
              />
            );
          })}
        </ul>
      </div>

      {!isMobile && pending > 0 && (
        <p className="shrink-0 border-t border-border px-4 py-2 text-xs text-ink-secondary">
          Keys: A accept · K keep original · E edit · S decide later
        </p>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {lastAction && `${lastAction}. ${progress.reviewed} of ${progress.total} reviewed.`}
      </p>
    </aside>
  );
}
