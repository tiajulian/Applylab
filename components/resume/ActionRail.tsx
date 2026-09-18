"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CopyIcon, DownloadIcon, EyeIcon, PencilIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";

/** Floating vertical rail beside the canvas: preview toggle, download (moved here from
 * EditorTopBar), a disabled share stub (no share/link feature exists yet - see the task's DEFER
 * list), and an upgrade shortcut for free-plan users. Docked within the canvas's own flex row
 * (see ResumeEditor.tsx) rather than breaking out of the dashboard's shared max-width shell. */
export function ActionRail({
  isPreviewMode,
  onTogglePreview,
  isPaidPlan,
  isUnlocked,
  downloadingFormat,
  onDownload,
  onDownloadLocked,
}: {
  isPreviewMode: boolean;
  onTogglePreview: () => void;
  isPaidPlan: boolean;
  isUnlocked: boolean;
  downloadingFormat: "pdf" | "docx" | null;
  onDownload: (format: "pdf" | "docx") => void;
  onDownloadLocked: () => void;
}) {
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDownloadOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setIsDownloadOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsDownloadOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDownloadOpen]);

  function handleDownloadClick() {
    if (isPaidPlan || isUnlocked) {
      setIsDownloadOpen((open) => !open);
      return;
    }
    onDownloadLocked();
  }

  const railButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary shadow-xs transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-2 pt-1">
      <button
        type="button"
        aria-label={isPreviewMode ? "Exit preview, back to editing" : "Preview read-only view"}
        title={isPreviewMode ? "Exit preview" : "Preview (read-only)"}
        aria-pressed={isPreviewMode}
        onClick={onTogglePreview}
        className={`${railButtonClass} ${isPreviewMode ? "border-accent bg-accent-soft text-accent" : ""}`}
      >
        {isPreviewMode ? <PencilIcon className="h-4 w-4" strokeWidth={2.5} /> : <EyeIcon className="h-4 w-4" strokeWidth={2.5} />}
      </button>

      <div className="relative" ref={downloadRef}>
        <button
          type="button"
          aria-label="Download resume"
          aria-expanded={isDownloadOpen}
          aria-haspopup="menu"
          title={isPaidPlan || isUnlocked ? "Download" : "Upgrade or unlock to download"}
          onClick={handleDownloadClick}
          disabled={downloadingFormat !== null}
          className={railButtonClass}
        >
          <DownloadIcon className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <AnimatePresence>
          {isDownloadOpen && (
            <motion.div
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute right-full top-0 z-30 mr-2 flex w-36 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-pop"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setIsDownloadOpen(false);
                  onDownload("pdf");
                }}
              >
                <span>PDF (.pdf)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setIsDownloadOpen(false);
                  onDownload("docx");
                }}
              >
                <span>Word (.docx)</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        aria-label="Share"
        title="Share - coming soon"
        disabled
        className={railButtonClass}
      >
        <CopyIcon className="h-4 w-4" strokeWidth={2.5} />
      </button>

      {!isPaidPlan && (
        <Link
          href="/upgrade"
          aria-label="Upgrade"
          title="Upgrade for unlimited scoring and downloads"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent shadow-xs transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SparklesIcon className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
