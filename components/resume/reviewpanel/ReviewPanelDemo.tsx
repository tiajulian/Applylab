"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useReviewEntries } from "@/lib/hooks/useReviewEntries";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { reviewProgress, type ReviewEntry } from "@/lib/review/progress";
import type { ReviewItem } from "@/lib/review/types";
import { chipState, ReviewChip } from "./ReviewChip";
import { ReviewPanel, type ReviewTab } from "./ReviewPanel";
import { SAMPLE_LABELS, SAMPLE_TEXTS, sampleItems } from "./sampleReview";

/**
 * The chip and panel on sample data, with just enough state to behave like the editor: accepting a fix
 * edits the text and the fix leaves the list, keeping a rewrite puts the original back, undo reverses both.
 * Used by the dev preview page and the panel tests.
 */
export function ReviewPanelDemo({ startOpen = true }: { startOpen?: boolean }) {
  const [items, setItems] = useState(sampleItems);
  const [texts, setTexts] = useState<ReadonlyMap<string, string>>(() => new Map(Object.entries(SAMPLE_TEXTS)));
  const [labels] = useState<ReadonlyMap<string, string>>(() => new Map(Object.entries(SAMPLE_LABELS)));
  const order = useMemo(() => new Map(Object.keys(SAMPLE_TEXTS).map((id, i) => [id, i])), []);
  const [tab, setTab] = useState<ReviewTab>("change");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(startOpen);
  const chipRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile(768);
  const { entries, record, forget } = useReviewEntries(items, order);
  const progress = useMemo(() => reviewProgress(entries), [entries]);

  const setStatus = useCallback((ids: string[], status: ReviewItem["status"]) => {
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, status } : i)));
  }, []);
  /** In the app a decided fix (or a reverted rewrite) stops matching and drops out of the list. */
  const drop = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const write = (blockId: string, text: string) => setTexts((prev) => new Map(prev).set(blockId, text));
  const textOf = (blockId: string) => texts.get(blockId) ?? "";

  function select(id: string) {
    setSelectedId(id);
    const item = items.find((i) => i.id === id);
    if (item) setTab(item.kind);
  }

  function accept(item: ReviewItem): boolean {
    if (item.kind === "change") {
      setStatus([item.id], "accepted");
      record(item, "accepted");
      return true;
    }
    const current = textOf(item.blockId);
    const next = current.slice(0, item.start) + item.after + current.slice(item.end);
    write(item.blockId, next);
    drop(item.id);
    record(item, "accepted", { blockId: item.blockId, from: next, to: current });
    return true;
  }

  function keep(item: ReviewItem): boolean {
    if (item.kind === "fix") {
      setStatus([item.id], "dismissed");
      record(item, "kept");
      return true;
    }
    write(item.blockId, item.before);
    drop(item.id);
    record(item, "kept", { blockId: item.blockId, from: item.before, to: item.after });
    return true;
  }

  function saveEdit(item: ReviewItem, text: string): boolean {
    const before = textOf(item.blockId);
    write(item.blockId, text);
    if (item.kind === "fix") drop(item.id);
    else setStatus([item.id], "accepted");
    record(item, "accepted", text === before ? undefined : { blockId: item.blockId, from: text, to: before });
    return true;
  }

  function undo({ item, undo: edit }: ReviewEntry) {
    if (edit && textOf(edit.blockId) === edit.from) write(edit.blockId, edit.to);
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? { ...i, status: "open" } : i)) : [...prev, { ...item, status: "open" }]));
    forget(item.id);
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-paper-deep p-4 md:h-screen md:flex-row md:p-6">
      <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
        <ReviewChip
          ref={chipRef}
          state={chipState("ready", progress)}
          progress={progress}
          isOpen={open}
          onClick={() => setOpen((v) => !v)}
        />
        <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-8 text-sm text-ink-secondary shadow-sm">
          Sample resume. The panel on the right is the real component, running on 5 rewrites and 3 fixes.
        </div>
      </div>
      {open && (
        <ReviewPanel
          entries={entries}
          tab={tab}
          onTabChange={setTab}
          selectedId={selectedId}
          isMobile={isMobile}
          labels={labels}
          texts={texts}
          canAccept={(item) => item.kind === "change" || Boolean(item.after)}
          canKeep={(item) => item.kind === "fix" || Boolean(item.before)}
          hasEvidenceFlow={() => false}
          onSelect={select}
          onAccept={accept}
          onKeep={keep}
          onSaveEdit={saveEdit}
          onUndo={undo}
          onOpenEvidence={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
