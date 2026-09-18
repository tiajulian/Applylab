"use client";

import {
  AlertCircleIcon,
  CheckCircleIcon,
  HistoryIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
} from "@/components/ui/icons/LucideIcons";
import { AccentColorToggle } from "@/components/resume/AccentColorToggle";
import { ReviewCounter } from "@/components/resume/ReviewCounter";
import { SectionOrderControl } from "@/components/resume/SectionOrderControl";
import type { TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { ReorderableResumeSection } from "@/lib/resume/resumeSections";
import type { FactCheckFlag } from "@/types";

function scoreTone(score: number): string {
  if (score >= 80) return "border-success/30 bg-success-soft text-success";
  if (score >= 50) return "border-attention/30 bg-attention-soft text-attention";
  return "border-critical/30 bg-critical-soft text-critical";
}

export function EditorToolbar({
  targetableCount,
  untargetableFlags,
  hadItemsToReview,
  onJumpNext,
  onSelectUntargetable,
  atsScore,
  isPaidPlan,
  isScoring,
  onScoreResume,
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
}: {
  targetableCount: number;
  untargetableFlags: FactCheckFlag[];
  hadItemsToReview: boolean;
  onJumpNext: () => void;
  onSelectUntargetable: (flag: FactCheckFlag) => void;
  atsScore?: number | null;
  isPaidPlan: boolean;
  isScoring: boolean;
  onScoreResume: () => void;
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
}) {
  const fitsOnePage = totalPages <= 1;
  const hasScore = atsScore !== null && atsScore !== undefined;

  return (
    <div
      role="toolbar"
      aria-label="Resume editor toolbar"
      className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs"
    >
      <div className="border-r border-border/70 pr-2">
        <ReviewCounter
          targetableCount={targetableCount}
          untargetableFlags={untargetableFlags}
          hadItemsInitially={hadItemsToReview}
          onJumpNext={onJumpNext}
          onSelectUntargetable={onSelectUntargetable}
        />
      </div>

      <button
        type="button"
        onClick={onScoreResume}
        disabled={isScoring}
        title={isPaidPlan ? "Run the full AI resume score" : "Upgrade to score your resume"}
        className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          hasScore ? scoreTone(atsScore as number) : "border-border bg-paper/50 text-ink hover:bg-paper-deep"
        }`}
      >
        <SparklesIcon className="h-3 w-3" strokeWidth={2.75} />
        <span>{isScoring ? "Scoring…" : hasScore ? `Score ${atsScore}/100` : isPaidPlan ? "Score resume" : "Score resume (Pro)"}</span>
      </button>

      <SectionOrderControl sectionOrder={sectionOrder} onReorder={onReorderSection} />

      <div className="flex items-center gap-1.5">
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
      </div>

      <button
        type="button"
        disabled
        aria-label="Design and font settings"
        title="Design & Font settings - coming soon"
        className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink-muted opacity-60 cursor-not-allowed"
      >
        <span>Design & Font</span>
      </button>

      <button
        type="button"
        disabled
        aria-label="Clean formatting"
        title="Clean formatting - coming soon"
        className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink-muted opacity-60 cursor-not-allowed"
      >
        <span>Clean</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
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

        <div className="flex items-center gap-1 border-l border-border/70 pl-2">
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

        <button
          type="button"
          onClick={onOpenVersionHistory}
          className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HistoryIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2.75} />
          <span>History</span>
        </button>
      </div>
    </div>
  );
}
