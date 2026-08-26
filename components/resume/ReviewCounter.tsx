"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { FactCheckFlag } from "@/types";

/**
 * The map to anything the inline highlights on the preview don't cover: a small pill showing how
 * many distinct spots need review (grouped by target, so a bullet carrying two stacked flags
 * reads as "1 to review", not "2" - see flagsByTargetKey in ResumeEditor.tsx), plus a collapsed
 * list that's the ONLY way to reach an untargetable flag (e.g. a referee - the templates don't
 * render individual referees, see the known-gap comment in ATSSafeTemplate.tsx), so it's always
 * reachable, just collapsed by default.
 */
export function ReviewCounter({
  targetableCount,
  untargetableFlags,
  hadItemsInitially,
  onJumpNext,
  onSelectUntargetable,
}: {
  targetableCount: number;
  untargetableFlags: FactCheckFlag[];
  /** Whether this resume ever had review items, so a fully-resolved queue reads as a completed
   * task ("All set") rather than as an absent feature the user never sees any trace of. */
  hadItemsInitially: boolean;
  onJumpNext: () => void;
  onSelectUntargetable: (flag: FactCheckFlag) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const total = targetableCount + untargetableFlags.length;

  if (total === 0) {
    if (!hadItemsInitially) return null;
    return (
      <p className="inline-flex w-fit items-center rounded-pill border border-success/30 bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
        All set, nothing left to review.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onJumpNext}
          className="rounded-pill border border-attention/30 bg-attention-soft px-3 py-1.5 text-sm font-medium text-attention transition-colors duration-fast ease-editorial hover:bg-attention/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {total} to review
        </button>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-1 text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isOpen ? "Hide list" : "Show list"}
          <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <ul className="flex flex-col gap-1.5 rounded border border-attention/30 bg-attention-soft p-2">
              {targetableCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={onJumpNext}
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-attention hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {targetableCount} highlighted directly on the resume preview, click to jump to the next one
                  </button>
                </li>
              )}
              {untargetableFlags.map((flag, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onSelectUntargetable(flag)}
                    className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block font-medium text-attention">{flag.location}</span>
                    <span className="block text-attention">{flag.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
