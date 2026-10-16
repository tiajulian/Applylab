"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ArrowLeftIcon, CheckIcon, CopyIcon, ExternalLinkIcon, FilePenLineIcon, MoreHorizontalIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";
import type { AutosaveStatus } from "@/lib/hooks/useAutosave";

type Tab = "resume" | "cover-letter";

/** Compact, sticky editor header: document identity (title/company/Tailored badge) plus the
 * actions that don't belong on the resume canvas itself - cover letter, track application, and
 * the overflow-only AI Review / Duplicate links. Score lives in EditorToolbar and Download in
 * ActionRail (see ResumeEditor.tsx / ResumeWorkspace.tsx). */
export function EditorTopBar({
  resumeId,
  jobTitle,
  companyName,
  isTailored,
  saveStatus,
  saveError,
  tab,
  coverLetterExists,
  isGeneratingCoverLetter,
  onToggleOrGenerateCoverLetter,
  isTracked,
  isTracking,
  canTrack,
  onTrackApplication,
  onNewCoverLetter,
  jobUrl,
  onApplyClick,
}: {
  resumeId: string;
  jobTitle: string | null;
  companyName: string | null;
  isTailored: boolean;
  saveStatus?: AutosaveStatus;
  saveError?: string | null;
  tab: Tab;
  coverLetterExists: boolean;
  isGeneratingCoverLetter: boolean;
  onToggleOrGenerateCoverLetter: () => void;
  isTracked: boolean;
  isTracking: boolean;
  canTrack: boolean;
  onTrackApplication: () => void;
  /** Opens the new cover letter setup for this resume. */
  onNewCoverLetter?: () => void;
  /** The Find jobs listing this resume was made for: shows "Apply for this job". */
  jobUrl?: string | null;
  /** Called as that link opens the ad (starts the "Did you apply?" follow-up). */
  onApplyClick?: () => void;
}) {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOverflowOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOverflowOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverflowOpen]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* The phone tab bar steps aside in the editor, so this is the way back. */}
        <Link
          href="/documents"
          aria-label="Back to all resumes"
          title="Back to all resumes"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-h3 text-ink truncate leading-tight">
              {jobTitle || "General resume"}
            </h1>
            {isTailored && (
              <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent shrink-0">
                Tailored
              </span>
            )}
          </div>
          <span className="text-xs text-ink-muted truncate mt-0.5">
            {companyName || (isTailored ? "Tailored resume" : "Not made for a specific job")}
          </span>
        </div>

        {saveStatus && saveStatus !== "idle" && (
          <span className="hidden sm:inline text-xs text-ink-muted shrink-0" aria-live="polite">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && <span className="text-critical">{saveError ?? "Failed to save"}</span>}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {jobUrl && (
          // The listing's own link, as Find jobs gave it (Adzuna requires the redirect as-is).
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener"
            onClick={onApplyClick}
            title={isTracked ? "Open the job ad" : "Open the ad to apply with this resume"}
            className={
              isTracked
                ? "inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-xs font-medium text-ink-secondary hover:bg-paper-deep hover:text-ink"
                : "inline-flex h-9 items-center gap-1.5 rounded-pill bg-accent-hover px-3.5 text-xs font-semibold text-on-accent transition-[filter] hover:brightness-95"
            }
          >
            {isTracked ? "Open job ad" : "Apply for this job"}
            <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
        <Button
          type="button"
          variant={tab === "cover-letter" ? "primary" : "outline"}
          size="sm"
          onClick={onToggleOrGenerateCoverLetter}
          isLoading={isGeneratingCoverLetter}
          className="text-xs"
        >
          {tab === "cover-letter" ? "Back to resume" : coverLetterExists ? "Cover letter" : "Write a cover letter"}
        </Button>

        {isTracked ? (
          <Button href="/applications" variant="ghost" size="sm" className="text-xs text-success">
            <CheckIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2} />
            <span>In your applications</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onTrackApplication}
            isLoading={isTracking}
            disabled={!canTrack}
            title={canTrack ? "Add this job to your Applications list" : "Add a company and job title first"}
            className="text-xs text-ink-secondary hover:bg-paper-deep hover:text-ink"
          >
            I applied for this
          </Button>
        )}

        <div className="relative" ref={overflowMenuRef}>
          <button
            type="button"
            aria-label="More options"
            aria-expanded={isOverflowOpen}
            aria-haspopup="menu"
            onClick={() => setIsOverflowOpen((prev) => !prev)}
            title="More options"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontalIcon className="h-4 w-4" strokeWidth={2} />
          </button>

          <AnimatePresence>
            {isOverflowOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute right-0 z-30 mt-1.5 flex w-56 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-pop"
                role="menu"
              >
                <Link
                  href={`/resume/${resumeId}/review`}
                  className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-paper-deep"
                  onClick={() => setIsOverflowOpen(false)}
                  role="menuitem"
                >
                  <SparklesIcon className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                  <span>Check &amp; improve</span>
                </Link>
                <Link
                  href={`/resume/${resumeId}/duplicate`}
                  className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-paper-deep"
                  onClick={() => setIsOverflowOpen(false)}
                  role="menuitem"
                >
                  <CopyIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
                  <span>Copy for another job</span>
                </Link>
                {onNewCoverLetter && (
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-paper-deep"
                    onClick={() => {
                      setIsOverflowOpen(false);
                      onNewCoverLetter();
                    }}
                    role="menuitem"
                  >
                    <FilePenLineIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
                    <span>Write a separate cover letter</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

