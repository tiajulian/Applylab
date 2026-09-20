"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DownloadIcon } from "@/components/ui/icons/LucideIcons";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const menuItem = `flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-paper-deep ${focusRing}`;

/**
 * Download as PDF or Word, for the resume (icon button in the side rail) or the cover letter (labelled
 * button above the paper). One component so both go through the same paid / unlock gate: a free,
 * locked document opens the upgrade flow instead of the menu.
 */
export function DownloadMenu({
  noun,
  variant,
  isPaidPlan,
  isUnlocked,
  downloadingFormat,
  onDownload,
  onDownloadLocked,
  beforeDownload,
}: {
  noun: "resume" | "cover letter";
  variant: "rail" | "bar";
  isPaidPlan: boolean;
  isUnlocked: boolean;
  downloadingFormat: "pdf" | "docx" | null;
  onDownload: (format: "pdf" | "docx") => void;
  onDownloadLocked: () => void;
  /** Runs before a download starts (e.g. save the latest edit); returning false cancels it. */
  beforeDownload?: () => boolean | Promise<boolean>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
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

  const unlocked = isPaidPlan || isUnlocked;
  const busy = downloadingFormat !== null;

  async function choose(format: "pdf" | "docx") {
    setIsOpen(false);
    if (beforeDownload && !(await beforeDownload())) return;
    onDownload(format);
  }

  const trigger =
    variant === "rail"
      ? "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary shadow-xs transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      : "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition-colors hover:border-accent hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-60";
  const menuPosition = variant === "rail" ? "right-full top-0 mr-2" : "right-0 top-full mt-1.5";
  const enter = variant === "rail" ? { opacity: 0, x: 4 } : { opacity: 0, y: -4 };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Download ${noun}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={unlocked ? "Download" : "Upgrade or unlock to download"}
        onClick={() => (unlocked ? setIsOpen((open) => !open) : onDownloadLocked())}
        disabled={busy}
        className={`${trigger} ${focusRing}`}
      >
        <DownloadIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {variant === "bar" && <span>{busy ? "Preparing…" : "Download"}</span>}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={enter}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={enter}
            transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
            className={`absolute z-30 flex w-36 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-pop ${menuPosition}`}
            role="menu"
          >
            <button type="button" role="menuitem" className={menuItem} onClick={() => void choose("pdf")}>
              PDF (.pdf)
            </button>
            <button type="button" role="menuitem" className={menuItem} onClick={() => void choose("docx")}>
              Word (.docx)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
