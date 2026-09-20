"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontSizeStepper } from "@/components/resume/FontSizeStepper";
import { AlertCircleIcon, CheckCircleIcon, ChevronDownIcon, PaletteIcon } from "@/components/ui/icons/LucideIcons";
import { TOOLBAR_BUTTON, TOOLBAR_ICON } from "@/components/resume/toolbarButton";
import type { FontSizePt } from "@/lib/resume/templateDensity";

/** Consolidates the canvas's less-frequently-touched view controls behind one "Design & Font"
 * toolbar button: font size, fit-to-one-page, and page count. All CSS-transform/variable
 * driven (zoom via ResumePreviewPane's imperative handle, font size via the same handler
 * FontSizeStepper already used inline), so opening/using this never re-renders the document. */
export function ViewSettingsPopover({
  fontSizePt,
  onSelectFontSize,
  totalPages,
  onFitToOnePage,
}: {
  fontSizePt: FontSizePt;
  onSelectFontSize: (value: FontSizePt) => void;
  totalPages: number;
  onFitToOnePage: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fitsOnePage = totalPages <= 1;

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
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
        className={TOOLBAR_BUTTON}
      >
        <PaletteIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
        <span>Design & Font</span>
        <ChevronDownIcon className="h-3 w-3 text-ink-muted" strokeWidth={2} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-0 z-30 mt-1.5 flex w-64 flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-pop"
            role="menu"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-secondary">Font size</span>
              <FontSizeStepper value={fontSizePt} onChange={onSelectFontSize} />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs font-medium text-ink-secondary">
                {totalPages} {totalPages === 1 ? "page" : "pages"}
              </span>
              {fitsOnePage ? (
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
                  <CheckCircleIcon className="h-3 w-3" strokeWidth={2} />
                  Fits on one page
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onFitToOnePage}
                  title="One page is safer for most Australian employers"
                  className="inline-flex items-center gap-1.5 rounded-pill border border-attention/30 bg-attention-soft px-2.5 py-1 text-xs font-semibold text-attention shadow-xs transition-colors hover:bg-attention/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <AlertCircleIcon className="h-3 w-3" strokeWidth={2} />
                  <span>Fit to one page</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

