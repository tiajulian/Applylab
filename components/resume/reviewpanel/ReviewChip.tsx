"use client";

import { forwardRef } from "react";
import { CheckIcon, InfoIcon, ListIcon } from "@/components/ui/icons/LucideIcons";
import type { ReviewPhase } from "@/lib/hooks/useReviewItems";
import type { ReviewProgress } from "@/lib/review/progress";

export type ChipState = "idle" | "checking" | "clear" | "notStarted" | "inProgress" | "done";

export function chipState(phase: ReviewPhase, { total, reviewed }: Pick<ReviewProgress, "total" | "reviewed">): ChipState {
  if (phase === "idle") return "idle";
  if (phase === "checking") return "checking";
  if (total === 0) return "clear";
  if (reviewed === total) return "done";
  return reviewed === 0 ? "notStarted" : "inProgress";
}

/** The whole chip as one sentence, for the live region and the tests. */
export function chipLabel(state: ChipState, { total, reviewed, verify }: ReviewProgress): string {
  switch (state) {
    case "idle":
      return "Review suggestions";
    case "checking":
      return "Checking...";
    case "clear":
      return "No suggestions";
    case "done":
      return `All ${total} ${total === 1 ? "suggestion" : "suggestions"} reviewed`;
    default:
      return `Review suggestions, ${reviewed} of ${total}${verify > 0 ? `, ${verify} to verify` : ""}`;
  }
}

const TONE: Record<ChipState, string> = {
  idle: "border-border bg-paper/50 text-ink hover:bg-paper-deep",
  checking: "border-border bg-paper/50 text-ink-secondary",
  clear: "border-border bg-paper/50 text-ink hover:bg-paper-deep",
  notStarted: "border-attention/30 bg-attention-soft text-ink hover:bg-attention/15",
  inProgress: "border-attention/30 bg-attention-soft text-ink hover:bg-attention/15",
  done: "border-success/30 bg-success-soft text-success hover:bg-success/15",
};

const RING = { size: 18, stroke: 2.5 };
const RADIUS = (RING.size - RING.stroke) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A small circular progress ring; the fill is the share of suggestions reviewed. */
function ProgressRing({ fraction }: { fraction: number }) {
  return (
    <svg aria-hidden="true" width={RING.size} height={RING.size} viewBox={`0 0 ${RING.size} ${RING.size}`} className="shrink-0 -rotate-90 text-amber-600">
      <circle cx={RING.size / 2} cy={RING.size / 2} r={RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={RING.stroke} />
      <circle
        cx={RING.size / 2} cy={RING.size / 2} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={RING.stroke} strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - fraction)} className="transition-[stroke-dashoffset] duration-slow ease-editorial motion-reduce:transition-none"
      />
    </svg>
  );
}

function Lead({ state, fraction }: { state: ChipState; fraction: number }) {
  if (state === "checking") {
    return <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />;
  }
  if (state === "done" || state === "clear") return <CheckIcon className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />;
  if (state === "idle") return <ListIcon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />;
  return <ProgressRing fraction={fraction} />;
}

/**
 * The entry chip above the resume. Amber, not red: it is a to-do, not an error. A ring shows how far
 * through the suggestions the person is; every state pairs an icon with words. The live region reads
 * the whole label so a screen reader hears the count change.
 */
export const ReviewChip = forwardRef<
  HTMLButtonElement,
  { state: ChipState; progress: ReviewProgress; isOpen: boolean; onClick: () => void }
>(function ReviewChip({ state, progress, isOpen, onClick }, ref) {
  const { total, reviewed, verify } = progress;
  const label = chipLabel(state, progress);
  const counting = state === "notStarted" || state === "inProgress";
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls="review-panel"
        aria-haspopup="dialog"
        className={`inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed ${TONE[state]}`}
      >
        <Lead state={state} fraction={total === 0 ? 0 : reviewed / total} />
        {counting ? (
          <>
            <span>Review suggestions</span>
            <span className="font-medium text-ink-secondary">{reviewed} of {total}</span>
            {verify > 0 && (
              <>
                <span aria-hidden="true" className="h-4 w-px bg-attention/40" />
                <span className="inline-flex items-center gap-1 text-attention">
                  <InfoIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  {verify} to verify
                </span>
              </>
            )}
          </>
        ) : (
          <span>{label}</span>
        )}
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {label}
      </span>
    </>
  );
});
