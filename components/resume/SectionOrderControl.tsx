"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/ui/icons/LucideIcons";
import { DEFAULT_RESUME_SECTION_ORDER, RESUME_SECTION_LABELS } from "@/lib/resume/resumeSections";
import type { ReorderableResumeSection } from "@/lib/resume/resumeSections";

export function SectionOrderControl({
  sectionOrder,
  onReorder,
}: {
  sectionOrder?: ReorderableResumeSection[];
  onReorder: (index: number, direction: -1 | 1) => void;
}) {
  const order = sectionOrder ?? DEFAULT_RESUME_SECTION_ORDER;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>Reorder sections</span>
        <span className="text-[10px] text-ink-muted">▾</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-0 z-30 mt-1.5 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-pop"
            role="menu"
          >
            <p className="px-1.5 pb-1.5 pt-0.5 text-[11px] text-ink-muted">
              Order sections appear on the resume
            </p>
            {order.map((sectionId, index) => (
              <div
                key={sectionId}
                className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs text-ink hover:bg-paper-deep"
              >
                <span className="truncate">{RESUME_SECTION_LABELS[sectionId]}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`Move ${RESUME_SECTION_LABELS[sectionId]} up`}
                    disabled={index === 0}
                    onClick={() => onReorder(index, -1)}
                    className="rounded p-1 text-ink-muted hover:bg-paper hover:text-ink disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowUpIcon className="h-3 w-3" strokeWidth={2.75} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${RESUME_SECTION_LABELS[sectionId]} down`}
                    disabled={index === order.length - 1}
                    onClick={() => onReorder(index, 1)}
                    className="rounded p-1 text-ink-muted hover:bg-paper hover:text-ink disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArrowDownIcon className="h-3 w-3" strokeWidth={2.75} />
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
