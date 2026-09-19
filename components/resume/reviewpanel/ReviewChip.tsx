"use client";

import { forwardRef } from "react";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, ListIcon } from "@/components/ui/icons/LucideIcons";
import type { ReviewPhase } from "@/lib/hooks/useReviewItems";

export type ChipState = "idle" | "checking" | "clear" | "review" | "verify";

/** `count` is the number of highlighted passages, `verifyCount` how many open items need verifying. */
export function chipState(phase: ReviewPhase, count: number, verifyCount: number): ChipState {
  if (phase === "idle") return "idle";
  if (phase === "checking") return "checking";
  if (verifyCount > 0) return "verify";
  return count > 0 ? "review" : "clear";
}

export function chipLabel(state: ChipState, count: number, verifyCount: number): string {
  switch (state) {
    case "idle":
      return "Review";
    case "checking":
      return "Checking...";
    case "clear":
      return "All clear";
    case "verify":
      return `${count} to review, ${verifyCount} to verify`;
    case "review":
      return `${count} to review`;
  }
}

const TONE: Record<ChipState, string> = {
  idle: "border-border bg-paper/50 text-ink hover:bg-paper-deep",
  checking: "border-border bg-paper/50 text-ink-secondary",
  clear: "border-success/30 bg-success-soft text-success",
  review: "border-attention/30 bg-attention-soft text-attention hover:bg-attention/20",
  verify: "border-critical/30 bg-critical-soft text-critical hover:bg-critical/20",
};

function StateIcon({ state }: { state: ChipState }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (state === "checking") {
    return <span aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />;
  }
  if (state === "clear") return <CheckCircleIcon className={className} strokeWidth={2} aria-hidden="true" />;
  if (state === "verify") return <AlertTriangleIcon className={className} strokeWidth={2} aria-hidden="true" />;
  if (state === "review") return <AlertCircleIcon className={className} strokeWidth={2} aria-hidden="true" />;
  return <ListIcon className={className} strokeWidth={2} aria-hidden="true" />;
}

/** The toolbar chip. Every state pairs an icon with a text label, never colour alone. Opens the review
 * panel; the label sits in a polite live region so a screen reader hears the count change. */
export const ReviewChip = forwardRef<
  HTMLButtonElement,
  { state: ChipState; label: string; isOpen: boolean; onClick: () => void }
>(function ReviewChip({ state, label, isOpen, onClick }, ref) {
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls="review-panel"
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-semibold transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${TONE[state]}`}
      >
        <StateIcon state={state} />
        <span>{label}</span>
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {label}
      </span>
    </>
  );
});
