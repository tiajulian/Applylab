"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontSizeStepper } from "@/components/resume/FontSizeStepper";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  SparklesIcon,
} from "@/components/ui/icons/LucideIcons";
import { type TemplateComponentProps, type TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { FontSizePt, TemplateDensity } from "@/lib/resume/templateDensity";
import { factCheckTargetKey } from "@/types";
import type { FactCheckFlag, ResumeContent, Template } from "@/types";

const PAGE_HEIGHT = 792; // Standard A4 preview height in pixels for 560px width

export interface ResumePreviewPaneProps {
  resume: ResumeContent;
  templateDef: TemplateDefinition;
  fontSizePt: FontSizePt;
  density: TemplateDensity;
  accentColor?: string | null;
  atsScore?: number | null;
  missingKeywords?: string[];
  flags?: FactCheckFlag[];
  activeTargetKey?: string | null;
  activeSection?: string | null;
  onOpenTemplateModal: () => void;
  onSelectFontSize: (size: FontSizePt) => void;
  onSectionClick: (sectionId: string) => void;
  onHighlightActivate?: (key: string, rect: DOMRect) => void;
  onFitToOnePage: () => void;
}

export function ResumePreviewPane({
  resume,
  templateDef,
  fontSizePt,
  density,
  accentColor,
  atsScore,
  missingKeywords = [],
  flags = [],
  activeTargetKey,
  activeSection,
  onOpenTemplateModal,
  onSelectFontSize,
  onSectionClick,
  onHighlightActivate,
  onFitToOnePage,
}: ResumePreviewPaneProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showAtsKeywords, setShowAtsKeywords] = useState<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const PreviewComponent = templateDef.component;

  // Build fact-check highlights dictionary
  const highlights = useRef<Record<string, "flagged" | "active">>({});
  highlights.current = Object.fromEntries(
    flags
      .filter((f): f is typeof f & { target: NonNullable<typeof f.target> } => Boolean(f.target))
      .map((f) => {
        const key = factCheckTargetKey(f.target);
        return [key, key === activeTargetKey ? "active" : "flagged"];
      })
  );

  // Measure content height and derive real page count
  const measurePagination = () => {
    if (!contentRef.current) return;
    const scrollHeight = contentRef.current.scrollHeight;
    const computedPages = Math.max(1, Math.ceil((scrollHeight - 10) / PAGE_HEIGHT));
    setTotalPages(computedPages);
    setCurrentPage((prev) => Math.min(computedPages, Math.max(1, prev)));
  };

  useLayoutEffect(() => {
    measurePagination();
    const timeout = setTimeout(measurePagination, 60);
    return () => clearTimeout(timeout);
  }, [resume, fontSizePt, density, templateDef]);

  // Two-way section sync: opening a form section jumps the preview to that section's page
  useEffect(() => {
    if (!activeSection || !contentRef.current) return;
    const sectionEl = contentRef.current.querySelector(`[data-section="${activeSection}"]`) as HTMLElement | null;
    if (sectionEl) {
      const topOffset = sectionEl.offsetTop;
      const targetPage = Math.min(totalPages, Math.max(1, Math.floor((topOffset + 20) / PAGE_HEIGHT) + 1));
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }
  }, [activeSection, totalPages, currentPage]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-between gap-3 overflow-y-auto rounded-xl border border-border/80 bg-paper-deep/30 p-3 sm:p-4">
      {/* Top Preview Toolbar */}
      <div className="flex w-full max-w-[560px] flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
        <div className="flex items-center gap-2">
          {/* Page count chip */}
          <span className="rounded bg-paper-deep px-2 py-1 text-xs font-semibold text-ink-secondary">
            {totalPages} {totalPages === 1 ? "page" : "pages"}
          </span>

          {/* Template button */}
          <button
            type="button"
            onClick={onOpenTemplateModal}
            className="inline-flex items-center gap-1.5 rounded border border-border/80 bg-paper/50 px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Change template"
          >
            <span className={`h-2 w-2 rounded-full ${templateDef.accentClassName}`} />
            <span className="truncate max-w-[90px] sm:max-w-none">{templateDef.name}</span>
            <span className="text-[10px] text-ink-muted">▾</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Font size stepper */}
          <FontSizeStepper value={fontSizePt} onChange={onSelectFontSize} />

          {/* ATS score tag */}
          {atsScore !== null && atsScore !== undefined && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAtsKeywords((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-pill border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-bold text-success shadow-xs transition-colors hover:bg-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Click to view ATS matching keywords"
              >
                <CheckCircleIcon className="h-3 w-3" strokeWidth={2.75} />
                <span>ATS {atsScore}/100</span>
              </button>

              <AnimatePresence>
                {showAtsKeywords && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 z-30 mt-1.5 w-64 rounded-lg border border-border bg-surface p-3 shadow-pop text-left"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-border mb-2">
                      <span className="text-xs font-bold text-ink">ATS Evaluation</span>
                      <button
                        type="button"
                        onClick={() => setShowAtsKeywords(false)}
                        className="text-xs text-ink-muted hover:text-ink"
                      >
                        ✕
                      </button>
                    </div>
                    {missingKeywords.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-ink-muted">Recommended keywords to consider:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {missingKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="rounded bg-accent-soft/60 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-success">Great job! All key job keywords are present.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Two-page warning banner (Conditional) */}
      <AnimatePresence>
        {totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex w-full max-w-[560px] items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft/50 p-2.5 text-accent shadow-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircleIcon className="h-4 w-4 shrink-0 text-accent" strokeWidth={2.75} />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-accent leading-tight">
                  This runs to two pages
                </span>
                <span className="text-[11px] text-ink-secondary truncate">
                  One page is safer for most Australian employers.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onFitToOnePage}
              className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-accent px-3 py-1 text-xs font-semibold text-on-accent shadow-xs transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SparklesIcon className="h-3 w-3" strokeWidth={2.75} />
              <span>Fit to one page</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* One A4 Sheet (560px x 792px) */}
      <div
        ref={sheetRef}
        className="sheet relative h-[792px] w-[560px] max-w-full flex-none overflow-hidden rounded-sm border border-border/80 bg-white shadow-md select-none"
        style={{ width: "560px", height: `${PAGE_HEIGHT}px` }}
      >
        <div
          ref={contentRef}
          style={{
            transform: `translateY(-${(currentPage - 1) * PAGE_HEIGHT}px)`,
            transition: "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
            padding: "26px 30px",
          }}
        >
          <PreviewComponent
            resume={resume}
            density={{ ...density, fontPt: fontSizePt }}
            accentColor={accentColor}
            highlights={highlights.current}
            onHighlightActivate={onHighlightActivate}
            activeSection={activeSection}
            onSectionClick={onSectionClick}
          />
        </div>
      </div>

      {/* Fixed Page Navigation (Below Sheet) */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 py-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            aria-label="Previous page"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface text-ink transition-colors hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ‹
          </button>
          <span className="text-xs font-semibold text-ink-secondary tabular-nums">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface text-ink transition-colors hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ›
          </button>
        </div>
      ) : (
        <div className="h-7" />
      )}
    </div>
  );
}
