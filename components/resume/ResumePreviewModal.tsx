"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/ui/icons/LucideIcons";
import { PAGE_HEIGHT, SHEET_WIDTH, STANDARD_MARGIN_MM, canvasPagePadding } from "@/components/resume/ResumePreviewPane";
// Straight from lib/pdf/trimLadder.ts, never lib/pdf/pageFit.ts - that module's top-level imports
// (puppeteer-core, pdf-parse, a DOMMatrix polyfill meant for Node) would otherwise get pulled into
// this client bundle. trimLadder.ts itself has no such dependency, just pure data transforms.
import { applyTrim, buildTrimLadder } from "@/lib/pdf/trimLadder";
import type { TemplateDefinition } from "@/lib/resume/templateRegistry";
import type { TemplateDensity } from "@/lib/resume/templateDensity";
import type { ResumeContent } from "@/types";

// Leaves headroom for the close button/page margins around the modal rather than touching the
// viewport edges. Deliberately smaller than the container's own CSS caps (max-h-[90vh]/
// max-w-[95vw] below) rather than matching them exactly - the JS-computed scale is what actually
// sizes the pages, so it needs real margin under the CSS ceiling, or float rounding across
// multiple page boxes plus their gaps can push the total a few px past it. With zero margin that
// silently clipped both edges of a 2-page spread instead of fitting them (the container centers
// its content, so overflowing it crops symmetrically rather than sizing down further).
const MAX_PAGE_HEIGHT_VH = 0.86;
const MAX_WIDTH_VW = 0.9;
const MAX_SCALE = 1.35;
const PAGE_GAP = 24;
// Below this scale, a side-by-side, multi-page spread is too small to read comfortably even
// without any clipping bug - a narrow window (or a several-page resume) is better served by
// stacking pages vertically at a real, readable size and letting the modal scroll for the rest,
// same as a real PDF viewer falls back to single-page-at-a-time scrolling once a two-up spread
// stops fitting the window.
const MIN_SIDE_BY_SIDE_SCALE = 0.55;
// Mirrors lib/pdf/pageFit.ts's own PAGE_CEILING exactly (that module can't be imported here - see
// the import comment above) - one page is the goal, two is the accepted ceiling for a genuinely
// long career history, never three.
const PAGE_CEILING = 2;

export interface ResumePreviewModalProps {
  resume: ResumeContent;
  templateDef: TemplateDefinition;
  density: TemplateDensity;
  accentColor?: string | null;
  fontOverride?: string;
  lineHeightCeiling?: number;
  /** Design & Font panel margin (lib/resume/designPrefs.ts), already resolved to mm by the caller -
   * defaults to the standard 13mm. Previously this component applied no page padding at all
   * (reported, with a screenshot, as text touching/clipping past the page edges with no visible
   * corner) - canvasPagePadding is the exact same formula ResumePreviewPane's own canvas padding
   * already uses, so the popup's margin actually matches what editing/export show. */
  marginMm?: number;
  onClose: () => void;
}

/**
 * The "see the actual final page(s)" popup: a full-size, always-static (never editable - this is
 * the same print-accurate render PDF/DOCX export use) view of the resume, centered over a dimmed
 * backdrop. Multiple pages sit side by side rather than stacked, matching how a real print-preview
 * or PDF viewer's page-spread view reads, rather than this app's own continuous-scroll editing
 * canvas (ResumePreviewPane) - the two intentionally look different, since they serve different
 * jobs (editing flow vs. "what does this actually look like printed").
 *
 * Runs the EXACT same fit loop the real PDF export does (lib/pdf/pageFit.ts's
 * renderResumeToFittedPdf/buildTrimLadder/applyTrim): starting from the resume's current content
 * and the user's chosen font/spacing, it walks the same trim ladder (drop projects, drop the
 * referee line, tighten spacing, drop oldest-role bullets, trim the summary, shrink the font) and
 * picks the same "first state that fits one page, else the least-aggressive state that still
 * reaches the two-page ceiling" state the PDF generator would land on. Without this, a resume that
 * needs trimming would show its full, untrimmed content here - visibly different from what the
 * actual export produces, defeating the point of a preview. The one difference from the real
 * export: page-count is measured via this canvas's own scrollHeight/PAGE_HEIGHT (the same
 * technique ResumePreviewPane's own page-count chip already uses), not a real Puppeteer-rendered
 * PDF, since this runs in the user's own browser - a faithful preview, not a second PDF renderer.
 */
export function ResumePreviewModal(props: ResumePreviewModalProps) {
  const { resume, templateDef, density, accentColor, fontOverride, lineHeightCeiling, marginMm = STANDARD_MARGIN_MM, onClose } = props;
  const PreviewComponent = templateDef.component;
  const { v: pagePaddingV, h: pagePaddingH } = canvasPagePadding(marginMm);

  const ladder = useMemo(
    () => buildTrimLadder(resume, density.fontPt, density.spacingScale),
    [resume, density.fontPt, density.spacingScale]
  );

  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [winningIndex, setWinningIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [viewportSize, setViewportSize] = useState(() =>
    typeof window === "undefined" ? { width: 1200, height: 900 } : { width: window.innerWidth, height: window.innerHeight }
  );

  const pageCountAt = (index: number) => {
    const el = measureRefs.current[index];
    return el ? Math.max(1, Math.ceil((el.scrollHeight - 10) / PAGE_HEIGHT)) : 1;
  };

  useLayoutEffect(() => {
    function measure() {
      // Same selection logic as renderResumeToFittedPdf: first state that reaches one page wins
      // outright; otherwise remember the LEAST aggressive state that still reaches the two-page
      // ceiling (a resume that only needs light trimming to hit two pages shouldn't end up at
      // floor density just because one page was never reachable); if nothing ever got within the
      // ceiling, fall back to the ladder's final (most aggressive) state.
      let bestWithinCeiling: number | null = null;
      for (let i = 0; i < ladder.length; i++) {
        const pages = pageCountAt(i);
        if (pages <= 1) {
          setWinningIndex(i);
          setTotalPages(pages);
          return;
        }
        if (pages <= PAGE_CEILING && bestWithinCeiling === null) bestWithinCeiling = i;
      }
      const fallback = bestWithinCeiling ?? ladder.length - 1;
      setWinningIndex(fallback);
      setTotalPages(pageCountAt(fallback));
    }
    measure();
    // A second pass after layout/fonts settle, matching ResumePreviewPane's own measurePagination.
    const timeout = setTimeout(measure, 60);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder, fontOverride, lineHeightCeiling, pagePaddingV, pagePaddingH]);

  useEffect(() => {
    function onResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  // Scale is capped by BOTH available height (one page tall) and available width (every page,
  // side by side, plus the gaps between them) - a "totalPages side by side" spread only fits
  // together, shrinking as one unit, never wrapping to a second row (which is what flex-wrap did
  // before this fix: at a narrower viewport, page 2 silently dropped below page 1 - a genuinely
  // broken-looking overlap, not the side-by-side spread this feature is for).
  const availablePageHeight = Math.max(400, viewportSize.height * MAX_PAGE_HEIGHT_VH);
  const availableWidth = Math.max(320, viewportSize.width * MAX_WIDTH_VW);
  const requiredWidthAtScale1 = totalPages * SHEET_WIDTH + (totalPages - 1) * PAGE_GAP;
  const sideBySideScale = Math.min(MAX_SCALE, availablePageHeight / PAGE_HEIGHT, availableWidth / requiredWidthAtScale1);
  // If side by side would shrink every page below a readable size, stack them vertically instead,
  // sized only by the (much less constrained) single-page width/height - the container's own
  // overflow-auto then scrolls vertically through them, rather than rendering an ever-shrinking
  // or clipped horizontal spread.
  const stacked = totalPages > 1 && sideBySideScale < MIN_SIDE_BY_SIDE_SCALE;
  const scale = stacked ? Math.min(MAX_SCALE, availablePageHeight / PAGE_HEIGHT, availableWidth / SHEET_WIDTH) : sideBySideScale;

  const winningState = ladder[winningIndex] ?? ladder[0];
  const winningResume = applyTrim(resume, winningState);
  const visibleContent = (
    <PreviewComponent
      resume={winningResume}
      density={winningState.density}
      accentColor={accentColor}
      fontOverride={fontOverride}
      lineHeightCeiling={lineHeightCeiling}
    />
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resume preview"
      // Fully opaque, not the semi-transparent bg-black/60 this started as: the editing canvas
      // stays mounted (and visible) behind this portal the whole time the modal is open, and any
      // transparency here let its own render of the same resume - at its own, different scale and
      // scroll position - show faintly through, reading as scattered, broken-looking text
      // fragments around the modal's edges. Reported (with a screenshot) as still-broken after two
      // rounds of fixing the page-scaling math itself, which was never the actual cause here.
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink p-6"
      onMouseDown={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <XIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Off-screen, unclipped measuring copies - one per trim-ladder state, all rendered at once
          so every state can be measured in a single layout pass rather than a sequential trial-
          and-error loop. Never visible: zero-size + overflow:hidden on the OUTER box (not just
          visibility:hidden on each one) is deliberately belt-and-suspenders, staying invisible and
          out of layout flow even if something inside the resume's own render ever set visibility
          back to visible on a descendant, which visibility:hidden alone would not protect against. */}
      <div style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden", visibility: "hidden" }} aria-hidden="true">
        {ladder.map((state, i) => (
          <div
            key={i}
            ref={(el) => {
              measureRefs.current[i] = el;
            }}
            style={{ width: SHEET_WIDTH, padding: `${pagePaddingV}px ${pagePaddingH}px` }}
          >
            <PreviewComponent
              resume={applyTrim(resume, state)}
              density={state.density}
              accentColor={accentColor}
              fontOverride={fontOverride}
              lineHeightCeiling={lineHeightCeiling}
            />
          </div>
        ))}
      </div>

      <div
        className={
          stacked
            ? "flex max-h-[90vh] max-w-[95vw] flex-col items-center justify-start overflow-auto"
            : "flex max-h-[90vh] max-w-[95vw] flex-row flex-nowrap items-start justify-center overflow-auto"
        }
        style={{ gap: PAGE_GAP }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {Array.from({ length: totalPages }, (_, i) => (
          <div
            key={i}
            data-testid="preview-page"
            // rounded-2xl/shadow-2xl (not the editing canvas's own barely-visible rounded-sm page
            // frame) - this popup is a "here's your finished resume" reveal, not the editing
            // surface, so a more polished floating-card look fits the moment, matching what was
            // asked for by reference screenshot.
            className="shrink-0 overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ width: SHEET_WIDTH * scale, height: PAGE_HEIGHT * scale }}
          >
            <div style={{ width: SHEET_WIDTH, transform: `scale(${scale}) translateY(${-i * PAGE_HEIGHT}px)`, transformOrigin: "top left" }}>
              <div style={{ padding: `${pagePaddingV}px ${pagePaddingH}px` }}>{visibleContent}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
