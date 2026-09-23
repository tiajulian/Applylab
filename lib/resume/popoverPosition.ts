import type { CSSProperties } from "react";

const DEFAULT_VIEWPORT_MARGIN = 16;

/** Viewport-clamped `position: fixed` placement for a popover/menu anchored to a DOMRect (e.g.
 * from a clicked element's getBoundingClientRect()). Opens below the anchor by default, flips
 * above it when there isn't enough room below, and clamps horizontally so it never runs off
 * either edge of the viewport. Shared by FactCheckFixPanel (the fact-check fix popover) and
 * BulletImproveMenu (the canvas's floating AI-assist menu) so there's one positioning
 * implementation, not two - both need to escape the resume sheet's transformed/clipped ancestor
 * (see components/resume/ResumePreviewPane.tsx), which a plain absolutely-positioned child can't. */
export function computePopoverStyle(
  anchorRect: DOMRect,
  width: number,
  viewportMargin: number = DEFAULT_VIEWPORT_MARGIN
): CSSProperties {
  if (typeof window === "undefined") {
    return { position: "fixed", top: anchorRect.bottom + 8, left: anchorRect.left, width };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(anchorRect.left, viewportMargin), Math.max(vw - width - viewportMargin, viewportMargin));

  const spaceBelow = vh - anchorRect.bottom;
  const openAbove = spaceBelow < 240 && anchorRect.top > 240;
  if (openAbove) {
    return { position: "fixed", left, bottom: Math.max(vh - anchorRect.top + 8, viewportMargin), width };
  }
  return { position: "fixed", left, top: Math.min(anchorRect.bottom + 8, vh - viewportMargin), width };
}

/** Viewport-clamped `position: fixed` placement for the bullet selection-format toolbar
 * (BulletFormatToolbar), anchored to a live text selection's own bounding rect rather than a
 * static element. Opens ABOVE the selection by default (the opposite of computePopoverStyle's
 * below-first default - this matches the familiar Google Docs/Medium-style selection toolbar),
 * flipping below only when there isn't room above. A sibling function rather than a parameterized
 * variant of computePopoverStyle: the anchor shape (a moving selection rect, not a fixed element)
 * and the default direction are both genuinely different, and computePopoverStyle's two existing
 * callers (BulletImproveMenu, FactCheckFixPanel) stay untouched either way. */
export function computeSelectionToolbarStyle(
  selectionRect: DOMRect,
  width: number,
  viewportMargin: number = DEFAULT_VIEWPORT_MARGIN
): CSSProperties {
  const toolbarHeight = 40;
  if (typeof window === "undefined") {
    return { position: "fixed", top: Math.max(selectionRect.top - toolbarHeight - 8, viewportMargin), left: selectionRect.left, width };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(
    Math.max(selectionRect.left + selectionRect.width / 2 - width / 2, viewportMargin),
    Math.max(vw - width - viewportMargin, viewportMargin)
  );

  const spaceAbove = selectionRect.top;
  const openBelow = spaceAbove < toolbarHeight + 8 + viewportMargin;
  if (openBelow) {
    return { position: "fixed", left, top: Math.min(selectionRect.bottom + 8, vh - viewportMargin), width };
  }
  return { position: "fixed", left, top: Math.max(selectionRect.top - toolbarHeight - 8, viewportMargin), width };
}
