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
  const scale = Math.min(MAX_SCALE, availablePageHeight / PAGE_HEIGHT, availableWidth / requiredWidthAtScale1);
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

      {/* Off-screen, unclipped measuring copy - never visible, purely to get a real scrollHeight. */}
      <div style={{ position: "fixed", top: 0, left: -99999, width: SHEET_WIDTH, visibility: "hidden" }} aria-hidden="true">
        <div ref={measureRef}>{content}</div>
      </div>

      <div
        className="flex max-h-[90vh] max-w-[95vw] flex-row flex-nowrap items-start justify-center overflow-auto"
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
