"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCwIcon, ShieldCheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { TOOLBAR_BUTTON, TOOLBAR_ICON, TOOLBAR_SHAPE } from "@/components/resume/toolbarButton";
import { scoreStyles } from "@/components/ui/scoreBands";
import { isKeywordScore } from "@/lib/resume/keywordScore";

function scoreTone(score: number): string {
  const s = scoreStyles(score);
  return `${s.border} ${s.bg} ${s.text}`;
}

/**
 * One keyword comparison control. Unassessed/legacy results stay neutral; valid but stale
 * results keep their number with a warning. Comparisons only run on an explicit click.
 */
export function AtsScoreControl({
  atsScore,
  isScoreStale,
  missingKeywords,
  isPaidPlan,
  isScoring,
  onScoreResume,
  hasJobAd = true,
  isAssessmentValid = true,
}: {
  atsScore?: number | null;
  isScoreStale: boolean;
  missingKeywords: string[];
  isPaidPlan: boolean;
  isScoring: boolean;
  onScoreResume: () => void;
  hasJobAd?: boolean;
  isAssessmentValid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState(0);
  const validKeywords = Array.isArray(missingKeywords) && missingKeywords.every((word) => typeof word === "string" && word.trim());
  const assessed = hasJobAd && isAssessmentValid && isKeywordScore(atsScore) && validKeywords;
  const keywords = validKeywords ? [...new Set(missingKeywords.map((word) => word.trim()))] : [];
  function close() { setOpen(false); triggerRef.current?.focus(); }

  useEffect(() => {
    if (!open) return;
    if (hasJobAd && atsScore == null) { setOpen(false); return; }
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    const position = () => {
      const left = rootRef.current?.getBoundingClientRect().left ?? 0;
      const width = Math.min(256, window.innerWidth - 16);
      setOffset(Math.max(8 - left, Math.min(0, window.innerWidth - 8 - left - width)));
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", position);
    };
  }, [open, hasJobAd, atsScore]);

  if (hasJobAd && (atsScore === null || atsScore === undefined)) {
    return (
      <button
        type="button"
        onClick={onScoreResume}
        disabled={isScoring}
        title={isPaidPlan ? "Compare your saved resume with the job ad" : "Upgrade to compare your resume with the job ad"}
        className={TOOLBAR_BUTTON}
      >
        <ShieldCheckIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
        <span>{isScoring ? "Scoring…" : isPaidPlan ? "Keyword match" : "Keyword match (Pro)"}</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={!hasJobAd ? "A job ad is needed to assess keyword match" : !assessed || isScoreStale ? "Check again for a current keyword comparison" : "View keyword comparison details"}
        className={assessed ? `${TOOLBAR_SHAPE} ${scoreTone(atsScore!)}` : TOOLBAR_BUTTON}
      >
        <ShieldCheckIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
        <span>{isScoring ? "Scoring…" : !hasJobAd ? "Keyword match · Not assessed" : !assessed ? "Keyword match · Check again" : `Keyword match ${atsScore}/100`}</span>
        {assessed && isScoreStale && !isScoring && <span className="h-1.5 w-1.5 rounded-full bg-attention" role="img" aria-label="Outdated: the resume has changed since scoring" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Keyword comparison"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{ left: offset }}
            className="absolute z-30 mt-1.5 w-[min(16rem,calc(100vw-1rem))] rounded-lg border border-border bg-surface p-3 text-left shadow-pop"
          >
            <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-xs font-bold text-ink">Keyword comparison</span>
              <button type="button" aria-label="Close" onClick={close} className="rounded text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                <XIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <p className="mb-2 text-[11px] text-ink-secondary">
              ApplyLab guidance on wording shared with the job ad, not an employer&apos;s ATS score or a prediction of interview success.
            </p>

            {!hasJobAd ? <p className="text-xs text-ink-secondary">No job ad is attached, so keyword match is not assessed. You can still review your resume&apos;s writing and structure.</p>
              : !assessed ? <p className="text-xs text-ink-secondary">This saved result needs a new check. It may be incomplete, outdated or from earlier scoring checks.</p>
              : isScoreStale ? (
              <p className="mb-2 rounded-md bg-attention-soft px-2 py-1.5 text-xs text-attention">Your resume or job ad has changed since this was scored. Re-score for an up-to-date comparison.</p>
              ) : keywords.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-ink-secondary">Terms reported as missing (include only experience you actually have):</span>
                  <div className="mt-1 flex flex-wrap gap-1">{keywords.map((kw) => <span key={kw} className="min-w-0 max-w-full break-words rounded bg-accent-soft/60 px-1.5 py-0.5 text-[10px] font-medium text-accent">{kw}</span>)}</div>
                </div>
              ) : <p className="text-xs text-ink-secondary">No specific missing keywords were reported. This does not mean every job requirement is met.</p>}

            {hasJobAd && (
              <button type="button" onClick={onScoreResume} disabled={isScoring} className={`${TOOLBAR_BUTTON} mt-3 w-full justify-center`}>
                <RotateCwIcon className={TOOLBAR_ICON} strokeWidth={2} aria-hidden="true" />
                {isScoring ? "Scoring…" : isPaidPlan ? "Re-score" : "Re-score (Pro)"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
