"use client";

import { FONT_SIZE_STEPS, type FontSizePt } from "@/lib/resume/templateDensity";

/**
 * Discrete font-size control for the final resume editor (see ResumeEditor.tsx). Deliberately a
 * stepper over FONT_SIZE_STEPS, not free entry - the floor (9.5pt) matches FONT_FLOOR_PT exactly,
 * so this never lets a candidate pick a size the automatic page-fit trim ladder wouldn't already
 * be willing to reach on its own (see lib/pdf/trimLadder.ts).
 */
export function FontSizeStepper({
  value,
  onChange,
  disabled,
}: {
  value: FontSizePt;
  onChange: (value: FontSizePt) => void;
  disabled?: boolean;
}) {
  const index = FONT_SIZE_STEPS.indexOf(value);
  const currentIndex = index === -1 ? FONT_SIZE_STEPS.indexOf(10) : index;

  function step(delta: number) {
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= FONT_SIZE_STEPS.length) return;
    onChange(FONT_SIZE_STEPS[nextIndex]);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-secondary">Font size</span>
      <div className="flex items-center rounded border border-border bg-surface">
        <button
          type="button"
          aria-label="Smaller font"
          disabled={disabled || currentIndex === 0}
          onClick={() => step(-1)}
          className="flex h-8 w-8 items-center justify-center text-ink-secondary transition-colors duration-fast ease-editorial hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          −
        </button>
        <span className="w-12 text-center text-sm text-ink tabular-nums">{value}pt</span>
        <button
          type="button"
          aria-label="Larger font"
          disabled={disabled || currentIndex === FONT_SIZE_STEPS.length - 1}
          onClick={() => step(1)}
          className="flex h-8 w-8 items-center justify-center text-ink-secondary transition-colors duration-fast ease-editorial hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +
        </button>
      </div>
      {value === 9.5 && (
        <span className="text-xs text-ink-muted">Smallest readable size, a little tighter to scan and to parse.</span>
      )}
    </div>
  );
}
