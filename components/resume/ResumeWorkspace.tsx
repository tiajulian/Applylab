"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { CoverLetterPreview } from "@/components/resume/CoverLetterPreview";
import { ReviewBeforeExportModal } from "@/components/resume/ReviewBeforeExportModal";
import { SubscriptionUpsellModal } from "@/components/upgrade/SubscriptionUpsellModal";
import { ResumeDownsellModal } from "@/components/upgrade/ResumeDownsellModal";
import { VersionHistoryPanel } from "@/components/resume/VersionHistoryPanel";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  SparklesIcon,
} from "@/components/ui/icons/LucideIcons";
import { useProgressMessages } from "@/lib/hooks/useProgressMessages";
import { trackFunnelEvent } from "@/lib/analytics";
import type { ContentScoreBreakdown, ContentScoreIssue, FactCheckFlag, ProjectEntry, Resume } from "@/types";

/** Failed hard-fail gate checks reshaped into the same FactCheckFlag shape the export-review
 * modal already renders, so a gate failure (dropped wins, a date contradiction) shows up in the
 * one place users are already used to checking before they download, not a second parallel list. */
function gateFlagsFor(resume: Resume): FactCheckFlag[] {
  if (!resume.gate_result) return [];
  return resume.gate_result.checks
    .filter((check) => check.severity === "hard_fail" && !check.passed)
    .flatMap((check) =>
      check.details.map((detail) => ({
        severity: "high" as const,
        location: check.label,
        message: detail,
        value: "",
        ...(check.id === "duration_claim" ? { target: { kind: "summary" as const } } : {}),
      }))
    );
}

type Tab = "resume" | "cover-letter";

const COVER_LETTER_MESSAGES = [
  "Reading your resume...",
  "Drafting your cover letter...",
  "Almost done...",
];

export function ResumeWorkspace({
  resume,
  profileProjects = [],
  isPaidPlan,
  isResumeUnlocked = false,
  isInitiallyUnlockedNotification = false,
  isTrackedInitially,
  initialTab = "resume",
}: {
  resume: Resume;
  profileProjects?: ProjectEntry[];
  isPaidPlan: boolean;
  isResumeUnlocked?: boolean;
  isInitiallyUnlockedNotification?: boolean;
  isTrackedInitially: boolean;
  initialTab?: Tab;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>(initialTab === "cover-letter" ? "cover-letter" : "resume");
  const [isUnlocked, setIsUnlocked] = useState(isPaidPlan || isResumeUnlocked);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showDownsellModal, setShowDownsellModal] = useState(false);
  const [showVersionHistoryModal, setShowVersionHistoryModal] = useState(false);
  const [isTracked, setIsTracked] = useState(isTrackedInitially);
  const [isTracking, setIsTracking] = useState(false);
  const [coverLetter, setCoverLetter] = useState(resume.cover_letter_content);
  const [atsScore, setAtsScore] = useState(resume.ats_score);
  const [missingKeywords, setMissingKeywords] = useState(resume.missing_keywords ?? []);

  const [contentScore, setContentScore] = useState(resume.content_score);
  const [contentScoreBreakdown, setContentScoreBreakdown] = useState<ContentScoreBreakdown | null>(
    resume.content_score_breakdown
  );
  const [contentScoreIssues, setContentScoreIssues] = useState<ContentScoreIssue[]>(resume.content_score_issues);
  const [contentScoreCount, setContentScoreCount] = useState(resume.content_score_count);

  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<"pdf" | "docx" | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasConfirmedExport, setHasConfirmedExport] = useState(false);
  const [pendingDownloadFormat, setPendingDownloadFormat] = useState<"pdf" | "docx" | null>(null);
  const coverLetterProgressMessage = useProgressMessages(COVER_LETTER_MESSAGES, isGeneratingCoverLetter);

  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  // Sync unlocked status if prop changes or page loads with unlocked param
  useEffect(() => {
    if (isPaidPlan || isResumeUnlocked) {
      setIsUnlocked(true);
    }
  }, [isPaidPlan, isResumeUnlocked]);

  // Toast notification and automated file downloads when returning successfully from Stripe unlock checkout
  useEffect(() => {
    if (isInitiallyUnlockedNotification) {
      showToast("Resume unlocked! Downloading your clean PDF and Word files now...", "success");
      trackFunnelEvent("downsell_paid", { resumeId: resume.id, status: "completed" });

      async function autoDownload() {
        await performDownload("pdf");
        setTimeout(() => {
          void performDownload("docx");
        }, 800);
      }

      void autoDownload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitiallyUnlockedNotification, resume.id, showToast]);

  // Exit-intent trigger on watermarked resumes
  useEffect(() => {
    if (isPaidPlan || isUnlocked) return;

    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY <= 0) {
        let alreadyDismissed = false;
        try {
          alreadyDismissed =
            localStorage.getItem(`unlock_modal_dismissed_${resume.id}`) === "true" ||
            sessionStorage.getItem(`downsell_dismissed_${resume.id}`) === "true";
        } catch {
          // Ignore storage errors in private browsing
        }

        if (!alreadyDismissed && !showSubscriptionModal && !showDownsellModal) {
          setShowDownsellModal(true);
          trackFunnelEvent("downsell_shown", { resumeId: resume.id, price: 2.99, trigger: "exit_intent" });
        }
      }
    }

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [isPaidPlan, isUnlocked, resume.id, showSubscriptionModal, showDownsellModal]);

  // Close menus on tab switch or click outside
  useEffect(() => {
    setIsDownloadMenuOpen(false);
    setIsOverflowOpen(false);
  }, [tab]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDownloadMenuOpen(false);
        setIsOverflowOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleGenerateCoverLetter() {
    setError(null);
    setIsGeneratingCoverLetter(true);

    try {
      const response = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to generate cover letter");
        return;
      }

      setCoverLetter(data.coverLetter);
      setTab("cover-letter");
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }

  async function handleScoreResume() {
    if (!isPaidPlan) {
      router.push("/upgrade");
      return;
    }

    setError(null);
    setIsScoring(true);

    try {
      const response = await fetch(`/api/resume/${resume.id}/score`, { method: "POST" });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          router.push("/upgrade");
          return;
        }
        setError(data.error ?? "Failed to score resume");
        return;
      }

      setAtsScore(data.ats.score);
      setMissingKeywords(data.ats.missing_keywords);
      setContentScore(data.content.score);
      setContentScoreBreakdown(data.content.breakdown);
      setContentScoreIssues(data.content.issues);
      if (!data.fromCache) {
        setContentScoreCount((count) => count + 1);
      }
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsScoring(false);
    }
  }

  function handleDownloadButtonClick() {
    if (isPaidPlan || isUnlocked) {
      setIsDownloadMenuOpen((open) => !open);
      return;
    }

    trackFunnelEvent("download_clicked", { resumeId: resume.id, plan: "free", isUnlocked: false });
    setShowSubscriptionModal(true);
    trackFunnelEvent("sub_modal_shown", { resumeId: resume.id });
  }

  function handleDismissSubscriptionModal() {
    setShowSubscriptionModal(false);
    trackFunnelEvent("sub_modal_dismissed", { resumeId: resume.id });

    let alreadyDismissed = false;
    try {
      alreadyDismissed =
        localStorage.getItem(`unlock_modal_dismissed_${resume.id}`) === "true" ||
        sessionStorage.getItem(`downsell_dismissed_${resume.id}`) === "true";
    } catch {
      // Ignore storage availability errors
    }

    if (!alreadyDismissed) {
      setShowDownsellModal(true);
      trackFunnelEvent("downsell_shown", { resumeId: resume.id, price: 2.99 });
    }
  }

  function handleDownload(format: "pdf" | "docx") {
    if (!isPaidPlan && !isUnlocked) {
      trackFunnelEvent("download_clicked", { resumeId: resume.id, format, plan: "free", isUnlocked: false });
      setShowSubscriptionModal(true);
      trackFunnelEvent("sub_modal_shown", { resumeId: resume.id });
      return;
    }

    trackFunnelEvent("download_clicked", { resumeId: resume.id, format, isUnlocked: true });
    setIsDownloadMenuOpen(false);

    if (!hasConfirmedExport) {
      setPendingDownloadFormat(format);
      return;
    }

    void performDownload(format);
  }

  async function performDownload(format: "pdf" | "docx") {
    setError(null);
    setDownloadingFormat(format);

    try {
      const endpoint = format === "pdf" ? "/api/generate-pdf" : "/api/generate-docx";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id, type: tab === "resume" ? "resume" : "cover-letter" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? `Failed to generate ${format === "pdf" ? "PDF" : "Word document"}`);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resume.job_title ?? "resume"}-${tab}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setDownloadingFormat(null);
    }
  }

  async function handleTrackApplication() {
    setError(null);
    setIsTracking(true);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: resume.company_name,
          job_title: resume.job_title,
          resume_id: resume.id,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "Failed to track this application");
        return;
      }

      setIsTracked(true);
      showToast("Added to your applications tracker", "success");
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsTracking(false);
    }
  }

  function handleConfirmExport() {
    setHasConfirmedExport(true);
    const format = pendingDownloadFormat;
    setPendingDownloadFormat(null);
    if (format) void performDownload(format);
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 w-full flex-col overflow-hidden max-[1179px]:h-auto max-[1179px]:overflow-visible">
      {/* Sticky Document Header */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-paper/95 pb-3.5 backdrop-blur-xs">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-h3 text-ink truncate leading-tight">
              {resume.job_title || "Untitled role"}
            </h1>
            {resume.skills_bridge_id && (
              <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent shrink-0">
                Tailored
              </span>
            )}
          </div>
          <span className="text-xs text-ink-muted truncate mt-0.5">
            {resume.company_name || "Target application"}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cover letter toggle */}
          <Button
            type="button"
            variant={tab === "cover-letter" ? "primary" : "outline"}
            size="sm"
            onClick={() => (coverLetter ? setTab(tab === "cover-letter" ? "resume" : "cover-letter") : handleGenerateCoverLetter())}
            isLoading={isGeneratingCoverLetter}
            className="text-xs"
          >
            {tab === "cover-letter"
              ? "Back to resume"
              : coverLetter
              ? "Cover letter"
              : "Generate cover letter"}
          </Button>

          {/* Track application */}
          {isTracked ? (
            <Link href="/applications">
              <Button type="button" variant="ghost" size="sm" className="text-xs text-success">
                <CheckIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.75} />
                <span>Tracked</span>
              </Button>
            </Link>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleTrackApplication}
              isLoading={isTracking}
              disabled={!resume.company_name?.trim() || !resume.job_title?.trim()}
              title={
                !resume.company_name?.trim() || !resume.job_title?.trim()
                  ? "Add a company and job title to track this application"
                  : undefined
              }
              className="text-xs"
            >
              Track application
            </Button>
          )}

          {/* Score resume */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleScoreResume}
            isLoading={isScoring}
            title={isPaidPlan ? undefined : "Upgrade to score your resume"}
            className="text-xs"
          >
            <SparklesIcon className="h-3.5 w-3.5 mr-1 text-accent" strokeWidth={2.75} />
            <span>{atsScore !== null ? "Re-score" : isPaidPlan ? "Score resume" : "Score resume (Pro)"}</span>
          </Button>

          {/* Download Menu */}
          <div className="relative" ref={downloadMenuRef}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDownloadButtonClick}
              isLoading={downloadingFormat !== null}
              title={isPaidPlan || isUnlocked ? undefined : "Upgrade or unlock to download"}
              className="text-xs"
            >
              <DownloadIcon className="h-3.5 w-3.5 mr-1" strokeWidth={2.75} />
              <span>{isPaidPlan || isUnlocked ? "Download ▾" : "Download (Pro)"}</span>
            </Button>

            <AnimatePresence>
              {isDownloadMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute right-0 z-30 mt-1.5 flex w-40 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-pop"
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleDownload("pdf")}
                  >
                    <span>PDF (.pdf)</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded px-3 py-1.5 text-left text-xs font-medium text-ink transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleDownload("docx")}
                  >
                    <span>Word (.docx)</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Overflow Menu: AI Review, Duplicate, Version History */}
          <div className="relative" ref={overflowMenuRef}>
            <button
              type="button"
              aria-label="More options"
              aria-expanded={isOverflowOpen}
              onClick={() => setIsOverflowOpen((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-ink-secondary transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontalIcon className="h-4 w-4" strokeWidth={2.75} />
            </button>

            <AnimatePresence>
              {isOverflowOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute right-0 z-30 mt-1.5 flex w-48 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-pop"
                >
                  <Link
                    href={`/resume/${resume.id}/review`}
                    className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-paper-deep"
                    onClick={() => setIsOverflowOpen(false)}
                  >
                    <SparklesIcon className="h-3.5 w-3.5 text-accent" strokeWidth={2.75} />
                    <span>AI Resume Review</span>
                  </Link>
                  <Link
                    href={`/resume/${resume.id}/duplicate`}
                    className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-paper-deep"
                    onClick={() => setIsOverflowOpen(false)}
                  >
                    <CopyIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2.75} />
                    <span>Duplicate & tailor</span>
                  </Link>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-paper-deep"
                    onClick={() => {
                      setIsOverflowOpen(false);
                      setShowVersionHistoryModal(true);
                    }}
                  >
                    <HistoryIcon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2.75} />
                    <span>Version history</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {error && <p className="text-xs text-critical mt-2">{error}</p>}
      {isGeneratingCoverLetter && <p className="text-xs text-ink-muted mt-2">{coverLetterProgressMessage}</p>}

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 pt-3">
        {tab === "resume" && resume.resume_content && (
          <ResumeEditor
            resumeId={resume.id}
            initialResumeContent={resume.resume_content}
            profileProjects={profileProjects}
            initialTemplate={resume.template}
            initialFontSizePt={resume.font_size_pt ?? 10}
            isPaidPlan={isPaidPlan}
            initialFactCheckFlags={resume.fact_check_flags ?? []}
            initialBridgeFactCheckFlags={resume.bridge_fact_check_flags ?? []}
            skillsBridgeId={resume.skills_bridge_id}
            atsScore={atsScore}
            missingKeywords={missingKeywords}
            contentScore={contentScore}
            contentScoreBreakdown={contentScoreBreakdown}
            contentScoreIssues={contentScoreIssues}
            contentScoreCount={contentScoreCount}
            setContentScore={setContentScore}
            setContentScoreBreakdown={setContentScoreBreakdown}
            setContentScoreIssues={setContentScoreIssues}
            setContentScoreCount={setContentScoreCount}
          />
        )}

        {tab === "cover-letter" && coverLetter && resume.resume_content && (
          <div className="h-full overflow-y-auto">
            <CoverLetterPreview
              resumeId={resume.id}
              initialCoverLetter={coverLetter}
              contact={resume.resume_content.contact}
            />
          </div>
        )}
      </main>

      {/* Export Confirmation Gate */}
      {pendingDownloadFormat && (
        <ReviewBeforeExportModal
          flags={[...(resume.fact_check_flags ?? []), ...(resume.bridge_fact_check_flags ?? []), ...gateFlagsFor(resume)]}
          onConfirm={handleConfirmExport}
          onCancel={() => setPendingDownloadFormat(null)}
        />
      )}

      {/* Version History Modal */}
      <AnimatePresence>
        {showVersionHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-ink/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowVersionHistoryModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface shadow-pop"
              role="dialog"
              aria-modal="true"
              aria-labelledby="version-history-title"
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <h3 id="version-history-title" className="font-display text-h3 text-ink">
                  Version History
                </h3>
                <button
                  type="button"
                  onClick={() => setShowVersionHistoryModal(false)}
                  className="rounded-full p-1.5 text-ink-muted hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 overflow-y-auto">
                <VersionHistoryPanel
                  resumeId={resume.id}
                  onRestore={(updatedResume) => {
                    if (updatedResume.resume_content) {
                      setAtsScore(updatedResume.ats_score);
                      setContentScore(updatedResume.content_score);
                    }
                    setShowVersionHistoryModal(false);
                    showToast("Version restored", "success");
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SubscriptionUpsellModal
        isOpen={showSubscriptionModal}
        resumeId={resume.id}
        onClose={handleDismissSubscriptionModal}
      />

      <ResumeDownsellModal
        isOpen={showDownsellModal}
        resumeId={resume.id}
        resumeTitle={resume.job_title ?? undefined}
        onClose={() => setShowDownsellModal(false)}
      />
    </div>
  );
}
