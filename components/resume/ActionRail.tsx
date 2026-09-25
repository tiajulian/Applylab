"use client";

import Link from "next/link";
import { DownloadMenu } from "@/components/resume/DownloadMenu";
import { CopyIcon, EyeIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";

/** Floating vertical rail beside the canvas: preview popup trigger, download (moved here from
 * EditorTopBar), a disabled share stub (no share/link feature exists yet - see the task's DEFER
 * list), and an upgrade shortcut for free-plan users. Docked within the canvas's own flex row
 * (see ResumeEditor.tsx) rather than breaking out of the dashboard's shared max-width shell. */
export function ActionRail({
  onOpenPreview,
  isPaidPlan,
  isUnlocked,
  downloadingFormat,
  onDownload,
  onDownloadLocked,
}: {
  /** Opens ResumePreviewModal - the full-size, side-by-side-pages popup (see that component's own
   * comment for why it's a separate view rather than toggling the editing canvas read-only in
   * place). */
  onOpenPreview: () => void;
  isPaidPlan: boolean;
  isUnlocked: boolean;
  downloadingFormat: "pdf" | "docx" | null;
  onDownload: (format: "pdf" | "docx") => void;
  onDownloadLocked: () => void;
}) {
  const railButtonClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary shadow-xs transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-2 pt-1">
      <button
        type="button"
        aria-label="Preview resume"
        title="Preview"
        onClick={onOpenPreview}
        className={railButtonClass}
      >
        <EyeIcon className="h-4 w-4" strokeWidth={2} />
      </button>

      <DownloadMenu
        noun="resume"
        variant="rail"
        isPaidPlan={isPaidPlan}
        isUnlocked={isUnlocked}
        downloadingFormat={downloadingFormat}
        onDownload={onDownload}
        onDownloadLocked={onDownloadLocked}
      />

      <button
        type="button"
        aria-label="Share"
        title="Share - coming soon"
        disabled
        className={railButtonClass}
      >
        <CopyIcon className="h-4 w-4" strokeWidth={2} />
      </button>

      {!isPaidPlan && (
        <Link
          href="/upgrade"
          aria-label="Upgrade"
          title="Upgrade for unlimited scoring and downloads"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent shadow-xs transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SparklesIcon className="h-4 w-4" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

