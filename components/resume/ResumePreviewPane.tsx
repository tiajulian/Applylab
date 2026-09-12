"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontSizeStepper } from "@/components/resume/FontSizeStepper";
import {
  AlertCircleIcon,
  CheckCircleIcon,
} from "@/components/ui/icons/LucideIcons";
import { type TemplateComponentProps, type TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { FontSizePt, TemplateDensity } from "@/lib/resume/templateDensity";
import { factCheckTargetKey } from "@/types";
import type { FactCheckFlag, ResumeContent, Template } from "@/types";

const PAGE_HEIGHT = 792; // Standard A4 preview height in pixels for 560px width
const SHEET_WIDTH = 560;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

// Guards against float drift from repeated +/- 0.1 steps (0.3 + 0.1 !== 0.4 in JS).
function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

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
  /** True while this pane is CSS-hidden (display:none) behind the mobile Edit/Preview toggle
   * below the 1180px breakpoint — scrollHeight reads 0 while hidden, so pagination needs to
   * re-measure once it becomes visible again rather than trusting the stale count. */
  isHiddenOnMobile?: boolean;
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
  isHiddenOnMobile = false,
  onOpenTemplateModal,
  onSelectFontSize,
  onSectionClick,
  onHighlightActivate,
  onFitToOnePage,
}: ResumePreviewPaneProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showAtsKeywords, setShowAtsKeywords] = useState<boolean>(false);
  const [sheetScale, setSheetScale] = useState<number>(1);
  // null = auto-fit (tracks sheetScale as the pane resizes); a number once the user has zoomed
  // manually, overriding auto-fit until they reset it.
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const scale = userZoom ?? sheetScale;
  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetWrapperRef = useRef<HTMLDivElement>(null);

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
    if (isHiddenOnMobile) return;
    measurePagination();
    const timeout = setTimeout(measurePagination, 60);
    return () => clearTimeout(timeout);
  }, [resume, fontSizePt, density, templateDef, isHiddenOnMobile]);

  // Shrink the sheet to fit the available space so the toolbar, banner and page
  // nav are always visible without scrolling the pane itself.
  useLayoutEffect(() => {
    const wrapper = sheetWrapperRef.current;
    if (!wrapper) return;

    const updateScale = () => {
      const { width, height } = wrapper.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setSheetScale(Math.min(width / SHEET_WIDTH, height / PAGE_HEIGHT, 1));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [totalPages]);

  function handleZoomIn() {
    setUserZoom((current) => roundZoom(Math.min(MAX_ZOOM, (current ?? sheetScale) + ZOOM_STEP)));
  }

  function handleZoomOut() {
    setUserZoom((current) => roundZoom(Math.max(MIN_ZOOM, (current ?? sheetScale) - ZOOM_STEP)));
  }

  function handleResetZoom() {
    setUserZoom(null);
  }

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
    <div className="flex h-full w-full min-h-0 flex-col items-center gap-3 overflow-y-auto rounded-xl border border-border/80 bg-paper-deep/30 p-3 sm:p-4">
      {/* Top Preview Toolbar */}
      <div className="flex w-full max-w-[560px] shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
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

          {/* Zoom stepper */}
          <div className="flex items-center rounded border border-border bg-surface">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={scale <= MIN_ZOOM}
              onClick={handleZoomOut}
              className="flex h-8 w-7 items-center justify-center text-ink-secondary transition-colors duration-fast ease-editorial hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              −
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title={userZoom === null ? "Fitted to pane" : "Reset to fit"}
              className="w-11 text-center text-xs text-ink-secondary tabular-nums hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={scale >= MAX_ZOOM}
              onClick={handleZoomIn}
              className="flex h-8 w-7 items-center justify-center text-ink-secondary transition-colors duration-fast ease-editorial hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Font size stepper */}
          <FontSizeStepper value={fontSizePt} onChange={onSelectFontSize} />

          {/* Page-fit warning (inline, only when it runs over a page) */}
          {totalPages > 1 && (
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

      {/* Sheet area: fits the A4 sheet to the available space at 100% zoom (the default); once
          zoomed past that, this scrolls instead of clipping. margin: auto (not a flex
          justify/align-center) on the sized box is deliberate - centering via justify-content
          on an overflowing flex container makes the overflowed edges unreachable by scroll in
          some engines, margin:auto degrades to start-aligned-and-scrollable instead. */}
      <div ref={sheetWrapperRef} className="flex w-full min-h-0 flex-1 overflow-auto">
        <div className="m-auto shrink-0" style={{ width: SHEET_WIDTH * scale, height: PAGE_HEIGHT * scale }}>
          <div
            ref={sheetRef}
            className="sheet relative overflow-hidden rounded-sm border border-border/80 bg-white shadow-md select-none"
            style={{
              width: SHEET_WIDTH,
              height: PAGE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
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
        </div>
      </div>

      {/* Fixed Page Navigation (Below Sheet) */}
      {totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-center gap-3 py-1">
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
        <div className="h-7 shrink-0" />
      )}
    </div>
  );
}
