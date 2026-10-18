"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PASS_THROUGH_ON_EXIT } from "@/lib/motion";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { ArrowUpDownIcon, ChevronDownIcon, ChevronUpIcon, LockIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { closestCenter, DndContext, SortableContext, useDndSensors, verticalListSortingStrategy } from "@/components/templates/shared";
import { arrayMove, DEFAULT_RESUME_SECTION_ORDER, mergeVisibleOrder, moveItem, RESUME_SECTION_LABELS } from "@/lib/resume/resumeSections";
import type { ReorderableResumeSection } from "@/lib/resume/resumeSections";
import type { DragEndEvent } from "@/components/templates/shared";
import { TOOLBAR_BUTTON, TOOLBAR_ICON } from "@/components/resume/toolbarButton";

// Rough share of a page each section usually takes, so the mini page reads like a real layout
// (Experience tall, Tools short) instead of six identical bars. Purely illustrative.
const BOX_HEIGHT: Record<ReorderableResumeSection, number> = {
  summary: 52,
  experience: 130,
  skills: 60,
  tools: 52,
  projects: 84,
  education: 64,
};

const MOVE_BUTTON =
  "flex h-6 w-6 items-center justify-center rounded text-ink-secondary hover:bg-surface hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function SectionBox({
  id,
  isFirst,
  isLast,
  onMove,
}: {
  id: ReorderableResumeSection;
  isFirst: boolean;
  isLast: boolean;
  /** Up/down buttons: the keyboard (and no-drag) way to reorder. */
  onMove: (direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const label = RESUME_SECTION_LABELS[id];
  return (
    <div
      ref={setNodeRef}
      className={`flex select-none items-center rounded text-xs font-medium transition-colors ${
        isDragging ? "bg-accent-hover text-on-accent shadow-lg" : "bg-paper-deep text-ink"
      }`}
      style={{
        height: BOX_HEIGHT[id],
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`${label} - drag to move`}
        className="flex h-full flex-1 cursor-grab touch-none items-center justify-center rounded hover:bg-border-strong active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="absolute left-1.5 top-1 text-[10px] leading-none opacity-60" aria-hidden="true">
          ⋮⋮
        </span>
        {label}
      </div>
      <div className="flex flex-col pr-1">
        <button type="button" aria-label={`Move ${label} up`} disabled={isFirst} onClick={() => onMove(-1)} className={MOVE_BUTTON}>
          <ChevronUpIcon className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button type="button" aria-label={`Move ${label} down`} disabled={isLast} onClick={() => onMove(1)} className={MOVE_BUTTON}>
          <ChevronDownIcon className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function ReorderModal({
  order,
  visibleSections,
  onSetOrder,
  onClose,
}: {
  order: ReorderableResumeSection[];
  visibleSections?: ReorderableResumeSection[];
  onSetOrder: (next: ReorderableResumeSection[]) => void;
  onClose: () => void;
}) {
  const sensors = useDndSensors();
  // Only the sections this resume has; empty ones keep their place in the saved order.
  const shown = visibleSections ? order.filter((section) => visibleSections.includes(section)) : order;
  const setShown = (next: ReorderableResumeSection[]) => onSetOrder(mergeVisibleOrder(order, next));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setShown(arrayMove(shown, shown.indexOf(active.id as ReorderableResumeSection), shown.indexOf(over.id as ReorderableResumeSection)));
  }

  return (
    <motion.div exit={PASS_THROUGH_ON_EXIT} className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reorder-sections-title"
        className="relative flex max-h-[92vh] w-full max-w-md flex-col items-center overflow-y-auto rounded-xl bg-surface p-6 shadow-pop"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded p-1 text-ink-muted hover:bg-paper-deep hover:text-ink">
          <XIcon className="h-4 w-4" strokeWidth={2} />
        </button>
        <h2 id="reorder-sections-title" className="mb-4 px-6 text-center font-display text-xl text-ink">
          Drag the boxes, or use the arrows, to rearrange the sections
        </h2>

        {/* A mini page: the header is fixed (locked), the sections underneath reorder. */}
        <div className="w-64 rounded border border-border bg-white p-3 shadow-sm">
          <div className="relative mb-2 flex h-9 items-center justify-center rounded bg-paper-deep text-xs font-medium text-ink-muted">
            <LockIcon className="absolute left-1.5 top-1.5 h-3 w-3 opacity-60" strokeWidth={2} />
            Header
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={shown} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {shown.map((id, index) => (
                  <SectionBox
                    key={id}
                    id={id}
                    isFirst={index === 0}
                    isLast={index === shown.length - 1}
                    onMove={(direction) => setShown(moveItem(shown, index, direction))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-md bg-accent-hover px-5 py-2 text-sm font-semibold text-on-accent transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}

/** The toolbar's "Reorder sections" button: opens a pop-up with a mini page whose section boxes are
 * dragged into the order they should appear on the resume. */
export function SectionOrderControl({
  sectionOrder,
  visibleSections,
  onSetOrder,
}: {
  sectionOrder?: ReorderableResumeSection[];
  /** Sections with content; the rest aren't listed. Omitted: all of them. */
  visibleSections?: ReorderableResumeSection[];
  onSetOrder: (next: ReorderableResumeSection[]) => void;
}) {
  const order = sectionOrder ?? DEFAULT_RESUME_SECTION_ORDER;
  const [isOpen, setIsOpen] = useState(false);
  // SSR-safe portal gate: `document` doesn't exist on the server, so checking
  // `typeof document !== "undefined"` directly in render disagrees between the server pass and the
  // client's first pass and fails hydration (see components/templates/shared.tsx for the same fix).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className={TOOLBAR_BUTTON}
      >
        <ArrowUpDownIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
        Reorder sections
      </button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <ReorderModal order={order} visibleSections={visibleSections} onSetOrder={onSetOrder} onClose={() => setIsOpen(false)} />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
