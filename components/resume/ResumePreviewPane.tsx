"use client";

import { MAX_ZOOM, MIN_ZOOM, ZoomControl } from "@/components/resume/ZoomControl";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircleIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { analyzeResume, brevityScore, completenessScore } from "@/lib/resume/contentChecks";
import { type TemplateComponentProps, type TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { FontSizePt, TemplateDensity } from "@/lib/resume/templateDensity";
import type { ProjectEntry, ResumeContent, Template } from "@/types";

// How long to let typing settle before recomputing the live estimate - analyzeResume is free
// (pure/synchronous, no network/AI), so this is purely to avoid pointless re-render churn on
// every keystroke, not to save cost like the real AI score's own debounce discipline needs.
const LIVE_ESTIMATE_DEBOUNCE_MS = 400;

const PAGE_HEIGHT = 792; // Standard A4 preview height in pixels for 560px width
const SHEET_WIDTH = 560;

const ZOOM_STEP = 0.1;
const NO_HIGHLIGHTS: Record<string, "flagged" | "active"> = {};

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
  /** True once the resume has changed since atsScore was last computed - the AI score itself is
   * never auto-recomputed (it's a paid, quota-limited call), this just visually flags that the
   * number on screen may no longer reflect the current content. */
  isScoreStale?: boolean;
  missingKeywords?: string[];
  /** Blocks (data-fc-target keys) to highlight on the read-only preview; the editable canvas draws its
   * own highlights from ReviewHighlightContext. Derived from the editor's review list. */
  highlights?: Record<string, "flagged" | "active">;
  activeSection?: string | null;
  onOpenTemplateModal: () => void;
  onSectionClick: (sectionId: string) => void;
  onHighlightActivate?: (key: string, rect: DOMRect) => void;
  /** Reports the measured page count up to the editor toolbar's "fit to one page" status - the
   * action itself now lives there instead of a button in this pane's own toolbar. */
  onPageCountChange?: (totalPages: number) => void;
  /** Reports the current zoom scale (0-1+) up to ViewSettingsPopover for display - zoom itself is
   * still driven from here (or via the imperative handle) as a CSS transform, this is display-only. */
  /** Phase 2 WYSIWYG canvas passthrough - see components/templates/BaseResumeTemplate.tsx. All
   * optional and unused by default, so every existing caller renders exactly as before. */
  editable?: boolean;
  onFieldChange?: (next: ResumeContent) => void;
  onFieldCommit?: (next: ResumeContent) => void;
  onFieldBlur?: () => void;
  resumeId?: string;
  profileProjects?: ProjectEntry[];
}

/** Imperative handle so ResumeEditor.tsx's toolbar and keyboard shortcuts can drive zoom without this
 * pane lifting its zoom state up. */
export interface ResumePreviewPaneHandle {
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
    isScoreStale,
    missingKeywords = [],
    highlights = NO_HIGHLIGHTS,
    activeSection,
    onOpenTemplateModal,
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
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showAtsKeywords, setShowAtsKeywords] = useState<boolean>(false);
  const [showEstimateDetail, setShowEstimateDetail] = useState<boolean>(false);

  // Live, zero-cost estimate from the same deterministic checks the real (paid, quota-limited)
  // content score partly relies on - brevity and completeness are exactly the two sub-scores
  // scoreContent.ts computes without calling the AI at all, the other two (impact/clarity) need
  // the real Claude call this can't and shouldn't replace. Debounced (LIVE_ESTIMATE_DEBOUNCE_MS)
  // purely to avoid recomputing on every keystroke, not for cost - analyzeResume is free.
  const [liveEstimate, setLiveEstimate] = useState(() => {
    const findings = analyzeResume(resume);
    return Math.round((brevityScore(findings) + completenessScore(resume, findings)) / 2);
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      const findings = analyzeResume(resume);
      setLiveEstimate(Math.round((brevityScore(findings) + completenessScore(resume, findings)) / 2));
    }, LIVE_ESTIMATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [resume]);
  const [sheetScale, setSheetScale] = useState<number>(1);
  // null = auto-fit (tracks sheetScale as the pane resizes); a number once the user has zoomed
  // manually, overriding auto-fit until they reset it.
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const scale = userZoom ?? sheetScale;
  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetWrapperRef = useRef<HTMLDivElement>(null);

  const PreviewComponent = templateDef.component;

  // Measure content height and derive real page count - drives how many decorative page frames/
  // dividers/footers the continuous-scroll canvas below draws.
  const measurePagination = () => {
    if (!contentRef.current) return;
    const scrollHeight = contentRef.current.scrollHeight;
    const computedPages = Math.max(1, Math.ceil((scrollHeight - 10) / PAGE_HEIGHT));
    setTotalPages(computedPages);
    onPageCountChange?.(computedPages);
  };

  useLayoutEffect(() => {
    measurePagination();
    const timeout = setTimeout(measurePagination, 60);
    return () => clearTimeout(timeout);
  }, [resume, fontSizePt, density, templateDef]);

  // Fit the sheet's width to the available space (continuous scroll means height is never the
  // constraint - the pane itself scrolls), capped at 100% so short resumes don't get upscaled.
  useLayoutEffect(() => {
    const wrapper = sheetWrapperRef.current;
    if (!wrapper) return;

    const updateScale = () => {
      const { width } = wrapper.getBoundingClientRect();
      if (width <= 0) return;
      setSheetScale(Math.min(width / SHEET_WIDTH, 1));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  function handleZoomIn() {
    setUserZoom((current) => roundZoom(Math.min(MAX_ZOOM, (current ?? sheetScale) + ZOOM_STEP)));
  }

  function handleZoomOut() {
    setUserZoom((current) => roundZoom(Math.max(MIN_ZOOM, (current ?? sheetScale) - ZOOM_STEP)));
  }

  function handleResetZoom() {
    setUserZoom(null);
  }

  // Two-way section sync: opening a form section scrolls the (now continuous) canvas to it.
  useEffect(() => {
    // Item-level ids ("experience:2") are selected in place - only whole sections scroll into view.
    if (!activeSection || activeSection.includes(":") || !contentRef.current) return;
    const sectionEl = contentRef.current.querySelector(`[data-section="${activeSection}"]`) as HTMLElement | null;
    sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSection]);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleResetZoom,
    }),
    // handleZoomIn/handleZoomOut update state via a functional setUserZoom(current => ...)
    // updater, not by reading sheetScale/userZoom directly, so they never go stale between
    // renders - including them here would just recreate this handle object on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
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

          <ZoomControl zoomPercent={Math.round(scale * 100)} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onResetZoom={handleResetZoom} />
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Live estimate - free, deterministic (brevity + completeness only), updates as you
              type. Not a substitute for "Score resume" (impact/clarity need the real AI call). */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEstimateDetail((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-pill border border-border bg-paper px-2.5 py-1 text-xs font-semibold text-ink-secondary shadow-xs transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="A free, live estimate - length and completeness only. Run 'Score resume' for the full AI score."
            >
              <span>Est. {liveEstimate}/100</span>
            </button>
            <AnimatePresence>
              {showEstimateDetail && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 z-30 mt-1.5 w-56 rounded-lg border border-border bg-surface p-3 shadow-pop text-left"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-border mb-2">
                    <span className="text-xs font-bold text-ink">Live estimate</span>
                    <button
                      type="button"
                      onClick={() => setShowEstimateDetail(false)}
                      className="text-xs text-ink-muted hover:text-ink"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-ink-muted">
                    A free, live estimate based on bullet length and how complete each section is. It updates as you
                    type - for the full score (including how impactful and clear your wording reads), use{" "}
                    <span className="font-semibold text-ink">Score resume</span>.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ATS score tag */}
          {atsScore !== null && atsScore !== undefined && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAtsKeywords((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-pill border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-bold text-success shadow-xs transition-colors hover:bg-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={
                  isScoreStale
                    ? "The resume has changed since this was scored - click to view details, or re-score for an up to date number."
                    : "Click to view ATS matching keywords"
                }
              >
                <CheckCircleIcon className="h-3 w-3" strokeWidth={2} />
                <span>ATS {atsScore}/100</span>
                {isScoreStale && <span className="h-1.5 w-1.5 rounded-full bg-attention" aria-label="Outdated - resume has changed since scoring" />}
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
                        <XIcon className="h-4 w-4" />
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

      {/* Canvas area: continuous vertical scroll of the whole document, with decorative page
          frames (shadowed white rects), a divider label at each page seam, and a per-page
          footer drawn behind/around the single, un-split content flow below - see the frames/
          dividers/footers block. This keeps the document a single render (one editable DOM
          tree, no duplicated dnd-kit ids) while still reading as discrete pages, matching how
          far the existing scrollHeight-based pagination estimate (measurePagination above) can
          honestly place a page break without a real content-fragmentation engine: a block can
          still straddle a seam here, same as it could in the old page-flip view. margin: auto
          (not flex justify/align-center) on the sized box is deliberate - centering via
          justify-content on an overflowing flex container makes the overflowed edges
          unreachable by scroll in some engines, margin:auto degrades to start-aligned-and-
          scrollable instead. */}
      <div ref={sheetWrapperRef} className="flex w-full min-h-0 flex-1 overflow-auto">
        <div className="m-auto shrink-0" style={{ width: SHEET_WIDTH * scale, height: totalPages * PAGE_HEIGHT * scale }}>
          <div
            ref={sheetRef}
            className="relative select-none"
            style={{
              width: SHEET_WIDTH,
              height: totalPages * PAGE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="absolute inset-x-0 rounded-sm border border-border/80 bg-white shadow-md"
                style={{ top: i * PAGE_HEIGHT, height: PAGE_HEIGHT }}
              />
            ))}

            <div ref={contentRef} className="relative z-[2]" style={{ padding: "26px 30px" }}>
              <PreviewComponent
                resume={resume}
                density={{ ...density, fontPt: fontSizePt }}
                accentColor={accentColor}
                highlights={highlights}
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

            {Array.from({ length: totalPages }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-[1] flex items-center justify-between px-[30px] text-[7px] tracking-wide text-slate-400"
                style={{ top: i * PAGE_HEIGHT + PAGE_HEIGHT - 16 }}
              >
                <span>applylab.io</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark inside a fixed-size print-style page frame, not a next/image candidate */}
                <img src="/logo-icon.png" alt="" className="h-2.5 w-2.5 opacity-50" />
              </div>
            ))}

            {Array.from({ length: totalPages - 1 }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 z-[3] flex -translate-y-1/2 justify-center"
                style={{ top: (i + 1) * PAGE_HEIGHT }}
              >
                <span className="rounded-pill border border-border bg-paper px-2.5 py-0.5 text-[10px] font-semibold text-ink-muted shadow-xs">
                  Page {i + 2}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

