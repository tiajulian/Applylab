"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useProgressStage } from "@/lib/hooks/useProgressMessages";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/ui/icons/LucideIcons";

const STILL_WORKING_AFTER_MS = 60_000;

/**
 * The staged "working on it" panel shown while an AI call runs. Mount it only while the call is in
 * flight: each mount starts again from the first stage. `showPercent` swaps the indeterminate bar
 * for an estimated percentage (only where the stage timing is a fair guess at the real duration).
 */
export function GenerationProgress({
  stages,
  intervalMs,
  showPercent = false,
  children,
}: {
  stages: string[];
  intervalMs?: number;
  showPercent?: boolean;
  /** Notes under the stage list, e.g. what the AI is (not) doing and how long it takes. */
  children?: ReactNode;
}) {
  const { currentStage, stageIndex, progressPct } = useProgressStage(stages, true, intervalMs);
  // Past this point a run is unusually slow; say so rather than let the last stage sit
  // unexplained, which reads as stuck and invites a refresh that would lose the run.
  const [stillWorking, setStillWorking] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStillWorking(true), STILL_WORKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent-soft/40 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <svg className="h-4 w-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {/* Only the stage name is live: announcing the list or the ticking percent is noise. */}
          <span role="status" aria-live="polite" className="text-sm font-semibold text-ink">
            {currentStage}
          </span>
        </div>
        {showPercent && (
          <span aria-hidden="true" className="text-xs font-semibold tabular-nums text-accent">
            {progressPct}%
          </span>
        )}
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
        {showPercent ? (
          <div className="h-full bg-accent transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        ) : (
          <div className="indeterminate-bar" />
        )}
      </div>

      <ul className="grid gap-1.5 pt-1 text-xs sm:grid-cols-2">
        {stages.map((stage, idx) => (
          <li
            key={stage}
            className={
              idx < stageIndex ? "flex items-center gap-1.5 font-medium text-success"
              : idx === stageIndex ? "flex items-center gap-1.5 font-semibold text-accent"
              : "flex items-center gap-1.5 text-ink-muted"
            }
          >
            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
              {idx < stageIndex ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : idx === stageIndex ? (
                <ChevronRightIcon className="h-3.5 w-3.5" />
              ) : (
                <CircleIcon className="h-3 w-3" />
              )}
            </span>
            <span className="truncate">{stage.replace(/…/g, "")}</span>
          </li>
        ))}
      </ul>

      <p role="status" className="text-xs font-medium text-accent empty:hidden">
        {stillWorking &&
          "Still working, this one's taking longer than usual. No need to refresh, it'll appear here once it's ready."}
      </p>

      {children}
    </div>
  );
}
