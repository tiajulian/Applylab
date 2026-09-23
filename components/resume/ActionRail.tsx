"use client";

import Link from "next/link";
import { DownloadMenu } from "@/components/resume/DownloadMenu";
import { CopyIcon, EyeIcon, PaletteIcon, PencilIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";

/** Floating vertical rail beside the canvas: preview toggle, download (moved here from
 * EditorTopBar), a disabled share stub (no share/link feature exists yet - see the task's DEFER
 * list), and an upgrade shortcut for free-plan users. Docked within the canvas's own flex row
 * (see ResumeEditor.tsx) rather than breaking out of the dashboard's shared max-width shell. */
export function ActionRail({
  isPreviewMode,
  onTogglePreview,
  isDesignOpen,
  onToggleDesign,
  isPaidPlan,
  isUnlocked,
  downloadingFormat,
  onDownload,
  onDownloadLocked,
}: {
  isPreviewMode: boolean;
  onTogglePreview: () => void;
  isDesignOpen: boolean;
  onToggleDesign: () => void;
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
        aria-label={isPreviewMode ? "Exit preview, back to editing" : "Preview read-only view"}
        title={isPreviewMode ? "Exit preview" : "Preview (read-only)"}
        aria-pressed={isPreviewMode}
        onClick={onTogglePreview}
        className={`${railButtonClass} ${isPreviewMode ? "border-accent bg-accent-soft text-accent" : ""}`}
      >
        {isPreviewMode ? <PencilIcon className="h-4 w-4" strokeWidth={2} /> : <EyeIcon className="h-4 w-4" strokeWidth={2} />}
      </button>

      <button
        type="button"
        aria-label={isDesignOpen ? "Close design panel" : "Open design panel"}
        title={isDesignOpen ? "Close design panel" : "Design & Font"}
        aria-pressed={isDesignOpen}
        onClick={onToggleDesign}
        className={`${railButtonClass} ${isDesignOpen ? "border-accent bg-accent-soft text-accent" : ""}`}
      >
        <PaletteIcon className="h-4 w-4" strokeWidth={2} />
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

