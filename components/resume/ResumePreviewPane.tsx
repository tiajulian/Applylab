"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FontSizeStepper } from "@/components/resume/FontSizeStepper";
import { CheckCircleIcon } from "@/components/ui/icons/LucideIcons";
import { type TemplateComponentProps, type TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { FontSizePt, TemplateDensity } from "@/lib/resume/templateDensity";
import { factCheckTargetKey } from "@/types";
import type { FactCheckFlag, ProjectEntry, ResumeContent, Template } from "@/types";

const PAGE_HEIGHT = 792; // Standard A4 preview height in pixels for 560px width
const SHEET_WIDTH = 560;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

// Guards against float drift from repeated +/- 0.1 steps (0.3 + 0.1 !== 0.4 in JS).
function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

// Shared by the activeSection page-jump effect and jumpToNextFlag - which page an element at a
// given offsetTop from the top of the (always fully rendered, page-flip-clipped) content falls on.
function pageForOffset(topOffset: number, totalPages: number): number {
  return Math.min(totalPages, Math.max(1, Math.floor((topOffset + 20) / PAGE_HEIGHT) + 1));
}

// el.offsetTop alone is only reliable when nothing between el and the content container is itself
// positioned - true for the top-level [data-section] blocks (a single hop to their offsetParent),
// but not for a [data-fc-target] field, which usually sits inside a DraggableBlock/HoverRemoveRow
// wrapper that sets position:relative on itself (see components/templates/shared.tsx), making that
// wrapper - not the content container - el's offsetParent. Walking the offsetParent chain and
// summing each hop gives the true position regardless of how many such wrappers sit in between.
function cumulativeOffsetTop(el: HTMLElement, ancestor: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
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
  onOpenTemplateModal: () => void;
  onSelectFontSize: (size: FontSizePt) => void;
  onSectionClick: (sectionId: string) => void;
  onHighlightActivate?: (key: string, rect: DOMRect) => void;
  /** Reports the measured page count up to the editor toolbar's "fit to one page" status - the
   * action itself now lives there instead of a button in this pane's own toolbar. */
  onPageCountChange?: (totalPages: number) => void;
  /** Phase 2 WYSIWYG canvas passthrough - see components/templates/BaseResumeTemplate.tsx. All
   * optional and unused by default, so every existing caller renders exactly as before. */
  editable?: boolean;
  onFieldChange?: (next: ResumeContent) => void;
  onFieldCommit?: (next: ResumeContent) => void;
  onFieldBlur?: () => void;
  resumeId?: string;
  profileProjects?: ProjectEntry[];
}

/** Imperative handle so ResumeEditor.tsx's flag-review counter can ask the pane to jump to the
 * next flagged field without this pane needing to lift its page-flip pagination state up - see
 * jumpToNextFlag below. */
export interface ResumePreviewPaneHandle {
  /** Finds the next flagged field after the currently active one (DOM order, wrapping around),
   * switches to its page if needed, scrolls it into view, and reports it via onHighlightActivate -
   * the same callback a direct glyph click already uses. Returns false if there is nothing on the
   * canvas to jump to (e.g. only untargetable flags remain), so the caller can fall back. */
  jumpToNextFlag: () => boolean;
  /** Same actions the zoom stepper's own +/-/reset-to-fit buttons already perform - exposed so a
   * keyboard shortcut (Ctrl/Cmd +/-/0) can trigger them without this pane lifting its zoom state up. */
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const ResumePreviewPane = forwardRef<ResumePreviewPaneHandle, ResumePreviewPaneProps>(function ResumePreviewPane(
  {
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
    onPageCountChange,
    editable,
    onFieldChange,
    onFieldCommit,
    onFieldBlur,
    resumeId,
    profileProjects,
  },
  ref
) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showAtsKeywords, setShowAtsKeywords] = useState<boolean>(false);
  // Tracks cycling position independently of activeTargetKey: closing the fix panel correctly
  // clears activeTargetKey (nothing should read as "currently open" any more), but jumpToNextFlag
  // still needs to remember where it left off, or every jump after a close-and-reopen would
  // restart from the first flag instead of advancing to the next one.
  const lastJumpedKeyRef = useRef<string | null>(null);
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
    onPageCountChange?.(computedPages);
  };

  useLayoutEffect(() => {
    measurePagination();
    const timeout = setTimeout(measurePagination, 60);
    return () => clearTimeout(timeout);
  }, [resume, fontSizePt, density, templateDef]);

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

  // Two-way section sync: opening a form section jumps the preview to that section's page.
  // Deliberately NOT keyed on currentPage: this effect's job is "activeSection changed, so move
  // the page" - if currentPage were a dependency, this would re-run every time ANY code changes
  // the page (a manual Prev/Next click, or jumpToNextFlag below) and immediately snap it back to
  // wherever activeSection currently points, fighting every other way of changing pages.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!activeSection || !contentRef.current) return;
    const sectionEl = contentRef.current.querySelector(`[data-section="${activeSection}"]`) as HTMLElement | null;
    if (sectionEl) {
      const targetPage = pageForOffset(sectionEl.offsetTop, totalPages);
      setCurrentPage((prev) => (targetPage !== prev ? targetPage : prev));
    }
  }, [activeSection, totalPages]);

  useImperativeHandle(
    ref,
    () => ({
      jumpToNextFlag() {
        const container = contentRef.current;
        if (!container) return false;

        const targetKeys = new Set(
          flags.filter((f): f is typeof f & { target: NonNullable<typeof f.target> } => Boolean(f.target)).map((f) => factCheckTargetKey(f.target))
        );
        const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-fc-target]"));
        const seen = new Set<string>();
        const candidates = elements.filter((el) => {
          const key = el.dataset.fcTarget ?? "";
          if (!targetKeys.has(key) || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (candidates.length === 0) return false;

        const currentIndex = candidates.findIndex((el) => el.dataset.fcTarget === lastJumpedKeyRef.current);
        const next = candidates[(currentIndex + 1) % candidates.length];
        const key = next.dataset.fcTarget as string;
        lastJumpedKeyRef.current = key;

        const finish = () => {
          next.scrollIntoView({ behavior: "smooth", block: "center" });
          onHighlightActivate?.(key, next.getBoundingClientRect());
        };

        const targetPage = pageForOffset(cumulativeOffsetTop(next, container), totalPages);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
          // Matches this pane's own page-flip transition duration (see the sheet's
          // "transition: transform 0.22s" below) - waits for it to settle before measuring the
          // final rect, since getBoundingClientRect() mid-transition would be off.
          setTimeout(finish, 240);
        } else {
          finish();
        }
        return true;
      },
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleResetZoom,
    }),
    // handleZoomIn/handleZoomOut update state via a functional setUserZoom(current => ...)
    // updater, not by reading sheetScale/userZoom directly, so they never go stale between
    // renders - including them here would just recreate this handle object on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flags, currentPage, totalPages, onHighlightActivate]
  );

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
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-secondary">Zoom</span>
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
                title={userZoom === null ? "Fitted to pane — click to reset if you zoom manually" : "Reset to fit pane"}
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
                editable={editable}
                onFieldChange={onFieldChange}
                onFieldCommit={onFieldCommit}
                onFieldBlur={onFieldBlur}
                resumeId={resumeId}
                profileProjects={profileProjects}
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
});
