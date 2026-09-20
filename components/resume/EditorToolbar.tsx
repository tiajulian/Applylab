"use client";

import type { Ref } from "react";
import { HistoryIcon, LayoutDashboardIcon, RedoIcon, UndoIcon } from "@/components/ui/icons/LucideIcons";
import { AtsScoreControl } from "@/components/resume/AtsScoreControl";
import { AccentColorToggle } from "@/components/resume/AccentColorToggle";
import { ReviewChip, type ChipState } from "@/components/resume/reviewpanel/ReviewChip";
import { TOOLBAR_BUTTON, TOOLBAR_ICON } from "@/components/resume/toolbarButton";
import { SectionOrderControl } from "@/components/resume/SectionOrderControl";
import { ViewSettingsPopover } from "@/components/resume/ViewSettingsPopover";
import type { TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { FontSizePt } from "@/lib/resume/templateDensity";
import type { ReorderableResumeSection } from "@/lib/resume/resumeSections";
import type { ReviewProgress } from "@/lib/review/progress";

export function EditorToolbar({
  chipRef,
  chipState,
  chipProgress,
  isReviewOpen,
  onToggleReview,
  atsScore,
  isScoreStale,
  missingKeywords,
  isPaidPlan,
  isScoring,
  onScoreResume,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  sectionOrder,
  onSetSectionOrder,
  templateDef,
  onOpenTemplateModal,
  isModernTemplate,
  accentColor,
  onSelectAccentColor,
  onOpenVersionHistory,
  totalPages,
  onFitToOnePage,
  fontSizePt,
  onSelectFontSize,
}: {
  chipRef: Ref<HTMLButtonElement>;
  chipState: ChipState;
  chipProgress: ReviewProgress;
  isReviewOpen: boolean;
  onToggleReview: () => void;
  atsScore?: number | null;
  /** True once the resume has changed since the score was computed. */
  isScoreStale: boolean;
  missingKeywords: string[];
  isPaidPlan: boolean;
  isScoring: boolean;
  onScoreResume: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  sectionOrder?: ReorderableResumeSection[];
  onSetSectionOrder: (next: ReorderableResumeSection[]) => void;
  templateDef: TemplateDefinition;
  onOpenTemplateModal: () => void;
  isModernTemplate: boolean;
  accentColor: string | null;
  onSelectAccentColor: (accentColor: string) => void;
  onOpenVersionHistory: () => void;
  totalPages: number;
  onFitToOnePage: () => void;
  fontSizePt: FontSizePt;
  onSelectFontSize: (value: FontSizePt) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Resume editor toolbar"
      className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs"
    >
      <div className="border-r border-border/70 pr-2">
        <ReviewChip ref={chipRef} state={chipState} progress={chipProgress} isOpen={isReviewOpen} onClick={onToggleReview} />
      </div>

      <AtsScoreControl
        atsScore={atsScore}
        isScoreStale={isScoreStale}
        missingKeywords={missingKeywords}
        isPaidPlan={isPaidPlan}
        isScoring={isScoring}
        onScoreResume={onScoreResume}
      />

      <SectionOrderControl sectionOrder={sectionOrder} onSetOrder={onSetSectionOrder} />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenTemplateModal}
          className={TOOLBAR_BUTTON}
          aria-label="Change template"
          title={`Template: ${templateDef.name}. Click to change.`}
        >
          <LayoutDashboardIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
          <span>Template</span>
        </button>

        <AccentColorToggle isModernTemplate={isModernTemplate} accentColor={accentColor} onSelect={onSelectAccentColor} />
      </div>

      <ViewSettingsPopover
        fontSizePt={fontSizePt}
        onSelectFontSize={onSelectFontSize}
        totalPages={totalPages}
        onFitToOnePage={onFitToOnePage}
      />

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={onUndo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <UndoIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={onRedo}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <RedoIcon className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenVersionHistory}
          className={TOOLBAR_BUTTON}
        >
          <HistoryIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
          <span>History</span>
        </button>
      </div>
    </div>
  );
}

