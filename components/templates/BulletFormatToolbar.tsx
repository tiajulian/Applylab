"use client";

import { createPortal } from "react-dom";
import { BoldIcon, ItalicIcon } from "@/components/ui/icons/LucideIcons";
import { computeSelectionToolbarStyle } from "@/lib/resume/popoverPosition";
import { FLOATING_TOOLBAR_BUTTON } from "@/components/templates/floatingToolbarButtonStyle";

/**
 * The two-button (Bold, Italic only - see lib/resume/bulletMarkup.ts) floating toolbar that pops
 * up over a live text selection inside a bullet. Portaled to document.body, positioned above the
 * selection by default. EditableBullet (components/templates/shared.tsx) owns computing the anchor
 * rect and never renders this at the same time as the bullet's own structural FloatingToolbar - see
 * EditableBullet's onSelectionActiveChange and DraggableBlock's suppressToolbar prop, which is the
 * actual mechanism that keeps the two from ever overlapping. This component only needs to worry
 * about not colliding with the viewport edge, not with the other toolbar.
 *
 * data-selection-keep matches the same convention FloatingToolbar and BulletImproveMenu's own
 * portal already use, so the editor's click-outside-to-deselect listener treats a click here as
 * "inside", not "outside". onMouseDown -> preventDefault for the same reason FloatingToolbar does:
 * clicking Bold/Italic must not collapse the live selection before the click handler even runs.
 */
export function BulletFormatToolbar({
  anchorRect,
  isBold,
  isItalic,
  onBold,
  onItalic,
}: {
  anchorRect: DOMRect;
  isBold: boolean;
  isItalic: boolean;
  onBold: () => void;
  onItalic: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label="Text formatting"
      data-selection-keep
      className="z-50 flex items-center gap-0.5 rounded-xl bg-ink p-1 text-surface shadow-lg ring-1 ring-black/10"
      style={computeSelectionToolbarStyle(anchorRect, 76)}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        aria-label="Bold"
        title="Bold"
        aria-pressed={isBold}
        onClick={onBold}
        className={`${FLOATING_TOOLBAR_BUTTON} ${isBold ? "bg-surface/25" : ""}`}
      >
        <BoldIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Italic"
        title="Italic"
        aria-pressed={isItalic}
        onClick={onItalic}
        className={`${FLOATING_TOOLBAR_BUTTON} ${isItalic ? "bg-surface/25" : ""}`}
      >
        <ItalicIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>,
    document.body
  );
}
