"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { LockIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { closestCenter, DndContext, SortableContext, useDndSensors, verticalListSortingStrategy } from "@/components/templates/shared";
import { arrayMove, DEFAULT_RESUME_SECTION_ORDER, RESUME_SECTION_LABELS } from "@/lib/resume/resumeSections";
import type { ReorderableResumeSection } from "@/lib/resume/resumeSections";
import type { DragEndEvent } from "@/components/templates/shared";

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

function SectionBox({ id }: { id: ReorderableResumeSection }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${RESUME_SECTION_LABELS[id]} - drag to move`}
      className={`flex cursor-grab touch-none select-none items-center justify-center rounded text-xs font-medium transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isDragging ? "bg-success text-white shadow-lg" : "bg-slate-200 text-slate-800 hover:bg-slate-300"
      }`}
      style={{
        height: BOX_HEIGHT[id],
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        zIndex: isDragging ? 10 : undefined,
        position: "relative",
      }}
    >
      <span className="absolute left-1.5 top-1 text-[10px] leading-none opacity-60" aria-hidden="true">
        ⋮⋮
      </span>
      {RESUME_SECTION_LABELS[id]}
    </div>
  );
}

function ReorderModal({
  order,
  onSetOrder,
  onClose,
}: {
  order: ReorderableResumeSection[];
  onSetOrder: (next: ReorderableResumeSection[]) => void;
  onClose: () => void;
}) {
  const sensors = useDndSensors();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onSetOrder(arrayMove(order, order.indexOf(active.id as ReorderableResumeSection), order.indexOf(over.id as ReorderableResumeSection)));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
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
          Hold &amp; drag the boxes to rearrange the sections
        </h2>

        {/* A mini page: the header is fixed (locked), the sections underneath reorder. */}
        <div className="w-64 rounded border border-border bg-white p-3 shadow-sm">
          <div className="relative mb-2 flex h-9 items-center justify-center rounded bg-indigo-100 text-xs font-medium text-slate-700">
            <LockIcon className="absolute left-1.5 top-1.5 h-3 w-3 opacity-60" strokeWidth={2} />
            Header
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {order.map((id) => (
                  <SectionBox key={id} id={id} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-md bg-success px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Continue Editing
        </button>
      </motion.div>
    </div>
  );
}

/** The toolbar's "Reorder sections" button: opens a pop-up with a mini page whose section boxes are
 * dragged into the order they should appear on the resume. */
export function SectionOrderControl({
  sectionOrder,
  onSetOrder,
}: {
  sectionOrder?: ReorderableResumeSection[];
  onSetOrder: (next: ReorderableResumeSection[]) => void;
}) {
  const order = sectionOrder ?? DEFAULT_RESUME_SECTION_ORDER;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Reorder sections
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && <ReorderModal order={order} onSetOrder={onSetOrder} onClose={() => setIsOpen(false)} />}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
