"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCwIcon, ShieldCheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { TOOLBAR_BUTTON, TOOLBAR_ICON, TOOLBAR_SHAPE } from "@/components/resume/toolbarButton";

function scoreTone(score: number): string {
  if (score >= 80) return "border-success/30 bg-success-soft text-success";
  if (score >= 50) return "border-attention/30 bg-attention-soft text-attention";
  return "border-critical/30 bg-critical-soft text-critical";
}

/**
 * The one ATS score control in the editor toolbar. Before there is a score it is the button that runs
 * the (paid, quota-limited) AI score. Once scored it reads "ATS 78/100" and opens the details: the
 * keywords the job wants that the resume lacks, a note if the resume changed since scoring, and
 * Re-score. The AI score is never re-run automatically, so a stale number is flagged, not hidden.
 */
export function AtsScoreControl({
  atsScore,
  isScoreStale,
  missingKeywords,
  isPaidPlan,
  isScoring,
  onScoreResume,
}: {
  atsScore?: number | null;
  isScoreStale: boolean;
  missingKeywords: string[];
  isPaidPlan: boolean;
  isScoring: boolean;
  onScoreResume: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (atsScore === null || atsScore === undefined) {
    return (
      <button
        type="button"
        onClick={onScoreResume}
        disabled={isScoring}
        title={isPaidPlan ? "Run the full AI resume score" : "Upgrade to score your resume"}
        className={TOOLBAR_BUTTON}
      >
        <ShieldCheckIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
        <span>{isScoring ? "Scoring…" : isPaidPlan ? "ATS score" : "ATS score (Pro)"}</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={isScoreStale ? "The resume has changed since this was scored. Open for details or to re-score." : "View ATS details and matching keywords"}
        className={`${TOOLBAR_SHAPE} ${scoreTone(atsScore)}`}
      >
        <ShieldCheckIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
        <span>{isScoring ? "Scoring…" : `ATS ${atsScore}/100`}</span>
        {isScoreStale && !isScoring && <span className="h-1.5 w-1.5 rounded-full bg-attention" role="img" aria-label="Outdated: the resume has changed since scoring" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="ATS evaluation"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 z-30 mt-1.5 w-64 rounded-lg border border-border bg-surface p-3 text-left shadow-pop"
          >
            <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-xs font-bold text-ink">ATS evaluation</span>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                <XIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {isScoreStale && (
              <p className="mb-2 rounded-md bg-attention-soft px-2 py-1.5 text-xs text-attention">Your resume has changed since this was scored. Re-score for an up-to-date number.</p>
            )}

            {missingKeywords.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-secondary">Recommended keywords to consider:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {missingKeywords.map((kw) => (
                    <span key={kw} className="rounded bg-accent-soft/60 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-success">Great job! All key job keywords are present.</p>
            )}

            <button type="button" onClick={onScoreResume} disabled={isScoring} className={`${TOOLBAR_BUTTON} mt-3 w-full justify-center`}>
              <RotateCwIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
              {isScoring ? "Scoring…" : isPaidPlan ? "Re-score" : "Re-score (Pro)"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
