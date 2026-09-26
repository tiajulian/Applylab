"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/ui/icons/LucideIcons";
import { PAGE_HEIGHT, SHEET_WIDTH } from "@/components/resume/ResumePreviewPane";
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

export interface ResumePreviewModalProps {
  resume: ResumeContent;
  templateDef: TemplateDefinition;
  density: TemplateDensity;
  accentColor?: string | null;
  fontOverride?: string;
  lineHeightCeiling?: number;
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
 * Implementation: the resume is rendered once, off-screen, purely to measure its real height and
 * derive how many A4 pages it spans (same scrollHeight/PAGE_HEIGHT technique
 * ResumePreviewPane.measurePagination already uses). Each visible page is then its own render of
 * the exact same content, clipped to one PAGE_HEIGHT-tall window via a negative translateY - the
 * standard technique for a paginated view without a real content-fragmentation engine (also
 * already used, for the single continuous-scroll case, by ResumePreviewPane's own page frames).
 */
export function ResumePreviewModal(props: ResumePreviewModalProps) {
  const { resume, templateDef, density, accentColor, fontOverride, lineHeightCeiling, onClose } = props;
  const PreviewComponent = templateDef.component;
  const measureRef = useRef<HTMLDivElement>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [viewportSize, setViewportSize] = useState(() =>
    typeof window === "undefined" ? { width: 1200, height: 900 } : { width: window.innerWidth, height: window.innerHeight }
  );

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setTotalPages(Math.max(1, Math.ceil((el.scrollHeight - 10) / PAGE_HEIGHT)));
    }
    measure();
    // A second pass after layout/fonts settle, matching ResumePreviewPane's own measurePagination.
    const timeout = setTimeout(measure, 60);
    return () => clearTimeout(timeout);
  }, [resume, density, templateDef, fontOverride, lineHeightCeiling]);

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
  const content = (
    <PreviewComponent resume={resume} density={density} accentColor={accentColor} fontOverride={fontOverride} lineHeightCeiling={lineHeightCeiling} />
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resume preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
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

      {/* Off-screen, unclipped measuring copy - never visible, purely to get a real scrollHeight.
          Zero-size + overflow:hidden on the OUTER box (not just visibility:hidden on this one) is
          deliberately belt-and-suspenders: it stays invisible and out of layout flow even if
          something inside the resume's own render ever set visibility back to visible on a
          descendant, which visibility:hidden alone would not protect against. */}
      <div style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, overflow: "hidden", visibility: "hidden" }} aria-hidden="true">
        <div ref={measureRef} style={{ width: SHEET_WIDTH }}>
          {content}
        </div>
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
            className="shrink-0 overflow-hidden rounded-sm bg-white shadow-xl"
            style={{ width: SHEET_WIDTH * scale, height: PAGE_HEIGHT * scale }}
          >
            <div style={{ width: SHEET_WIDTH, transform: `scale(${scale}) translateY(${-i * PAGE_HEIGHT}px)`, transformOrigin: "top left" }}>
              {content}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
