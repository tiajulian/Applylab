"use client";

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.5;

const step =
  "flex h-11 w-11 items-center sm:h-9 sm:w-9 justify-center text-base font-semibold text-ink-secondary transition-colors duration-fast ease-editorial hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring";

/** Zoom out / current level / zoom in for the resume preview. The level resets to "fit the pane". */
export function ZoomControl({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}) {
  return (
    <div role="group" aria-label="Zoom" className="flex items-center overflow-hidden rounded-lg border border-border bg-surface">
      <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoomPercent <= Math.round(MIN_ZOOM * 100)} onClick={onZoomOut} className={step}>
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        onClick={onResetZoom}
        title="Reset to fit the pane"
        aria-label={`Zoom ${zoomPercent}%, reset to fit`}
        className="h-11 min-w-[3rem] sm:h-9 px-1 text-center text-xs font-semibold tabular-nums text-ink hover:text-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        {zoomPercent}%
      </button>
      <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoomPercent >= Math.round(MAX_ZOOM * 100)} onClick={onZoomIn} className={step}>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
