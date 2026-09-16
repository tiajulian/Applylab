"use client";

import { AlertCircleIcon, CheckCircleIcon, HistoryIcon, RedoIcon, UndoIcon } from "@/components/ui/icons/LucideIcons";
import { AccentColorToggle } from "@/components/resume/AccentColorToggle";
import { SectionOrderControl } from "@/components/resume/SectionOrderControl";
import type { AutosaveStatus } from "@/lib/hooks/useAutosave";
import type { TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { ReorderableResumeSection } from "@/lib/resume/resumeSections";

export function EditorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  sectionOrder,
  onReorderSection,
  templateDef,
  onOpenTemplateModal,
  isModernTemplate,
  accentColor,
  onSelectAccentColor,
  onOpenVersionHistory,
  totalPages,
  onFitToOnePage,
  saveStatus,
  saveError,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  sectionOrder?: ReorderableResumeSection[];
  onReorderSection: (index: number, direction: -1 | 1) => void;
  templateDef: TemplateDefinition;
  onOpenTemplateModal: () => void;
  isModernTemplate: boolean;
  accentColor: string | null;
  onSelectAccentColor: (accentColor: string) => void;
  onOpenVersionHistory: () => void;
  totalPages: number;
  onFitToOnePage: () => void;
  /** Autosave status from useAutosave, surfaced here so Ctrl/Cmd+S has something visible to
   * confirm it did anything - previously computed in ResumeEditor.tsx but never rendered. */
  saveStatus?: AutosaveStatus;
  saveError?: string | null;
}) {
  const fitsOnePage = totalPages <= 1;

  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
      <div className="flex items-center gap-1 border-r border-border/70 pr-2">
        <button
          type="button"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex h-7 w-7 items-center justify-center rounded text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UndoIcon className="h-3.5 w-3.5" strokeWidth={2.75} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex h-7 w-7 items-center justify-center rounded text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RedoIcon className="h-3.5 w-3.5" strokeWidth={2.75} />
        </button>
      </div>

      <SectionOrderControl sectionOrder={sectionOrder} onReorder={onReorderSection} />

      <button
        type="button"
        onClick={onOpenTemplateModal}
        className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Change template"
      >
        <span className={`h-2 w-2 rounded-full ${templateDef.accentClassName}`} />
        <span>{templateDef.name}</span>
        <span className="text-[10px] text-ink-muted">▾</span>
      </button>

      <AccentColorToggle isModernTemplate={isModernTemplate} accentColor={accentColor} onSelect={onSelectAccentColor} />

      <button
        type="button"
        onClick={onOpenVersionHistory}
        className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HistoryIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2.75} />
        <span>History</span>
      </button>

      {saveStatus && saveStatus !== "idle" && (
        <span className="text-xs text-ink-muted">
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && <span className="text-critical">{saveError ?? "Failed to save"}</span>}
        </span>
      )}

      <div className="ml-auto">
        {fitsOnePage ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            <CheckCircleIcon className="h-3 w-3" strokeWidth={2.75} />
            Fits on one page
          </span>
        ) : (
          <button
            type="button"
            onClick={onFitToOnePage}
            title="One page is safer for most Australian employers"
            className="inline-flex items-center gap-1.5 rounded-pill border border-attention/30 bg-attention-soft px-2.5 py-1 text-xs font-semibold text-attention shadow-xs transition-colors hover:bg-attention/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AlertCircleIcon className="h-3 w-3" strokeWidth={2.75} />
            <span>Fit to one page</span>
          </button>
        )}
      </div>
    </div>
  );
}
