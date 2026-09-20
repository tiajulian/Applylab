"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { EditorTopBar } from "@/components/resume/EditorTopBar";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { CoverLetterPreview } from "@/components/resume/CoverLetterPreview";
import { NewCoverLetterModal } from "@/components/coverLetter/NewCoverLetterModal";
import { COVER_LETTER_V1_ENABLED } from "@/lib/coverLetter/config";
import { ReviewBeforeExportModal } from "@/components/resume/ReviewBeforeExportModal";
import { SubscriptionUpsellModal } from "@/components/upgrade/SubscriptionUpsellModal";
import { ResumeDownsellModal } from "@/components/upgrade/ResumeDownsellModal";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { useProgressMessages } from "@/lib/hooks/useProgressMessages";
import { trackFunnelEvent } from "@/lib/analytics";
import type { AutosaveStatus } from "@/lib/hooks/useAutosave";
import type { ContentScoreBreakdown, ContentScoreIssue, FactCheckFlag, ProjectEntry, Resume } from "@/types";
import type { ProfileSource } from "@/lib/review/provenance";

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
  profile = null,
  isPaidPlan,
  isResumeUnlocked = false,
  isInitiallyUnlockedNotification = false,
  isTrackedInitially,
  initialTab = "resume",
}: {
  resume: Resume;
  profileProjects?: ProjectEntry[];
  /** The Career Profile, for the review panel's deterministic provenance check. */
  profile?: ProfileSource | null;
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
  const [coverLetterLimitReached, setCoverLetterLimitReached] = useState(false);
  const [isNewCoverLetterOpen, setIsNewCoverLetterOpen] = useState(false);
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
  const [error, setError] = useState<string | null>(null);

  const [hasConfirmedExport, setHasConfirmedExport] = useState(false);
  const [pendingDownloadFormat, setPendingDownloadFormat] = useState<"pdf" | "docx" | null>(null);
  const coverLetterProgressMessage = useProgressMessages(COVER_LETTER_MESSAGES, isGeneratingCoverLetter);

  // Surfaced by ResumeEditor's useAutosave call so EditorTopBar can show it next to the document
  // title - the save itself still lives entirely inside ResumeEditor (it needs the live resume
  // snapshot from useResumeHistory), this just mirrors its status up for display.
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

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

  async function handleGenerateCoverLetter() {
    setError(null);
    setCoverLetterLimitReached(false);
    setIsGeneratingCoverLetter(true);

    try {
      const response = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: resume.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "FREE_LIMIT_REACHED") {
          setCoverLetterLimitReached(true);
          return;
        }
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

  function handleDownloadLocked() {
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

    // The review-before-export prompt is about the resume's flagged facts, which a cover letter has none of.
    if (tab === "resume" && !hasConfirmedExport) {
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
    /* 69px = the dashboard nav's rendered height (app/(dashboard)/layout.tsx's <header>,
     * measured directly - it isn't derivable from its own classes without doing the same
     * font/line-height math the browser does), 4rem = that layout's <main> py-8. The previous
     * 5.5rem (88px) guess didn't account for main's own padding at all, so this box rendered
     * ~45px taller than the space actually available and forced the whole page to scroll a
     * little even though every pane inside already has its own internal scrolling. */
    <div className="flex h-[calc(100dvh-69px-4rem)] min-h-0 w-full flex-col overflow-hidden max-[1179px]:h-auto max-[1179px]:overflow-visible">
      {/* Sticky Document Header. Opaque bg-paper (not bg-paper/95 + backdrop-blur-xs): Tailwind
       * can't generate an opacity variant for a color defined as a bare var() with no <alpha-value>
       * placeholder (see tailwind.config.ts), so bg-paper/95 silently produced no background at all
       * - on narrow viewports this let the Edit/Preview toggle and page content scroll up fully
       * visible through the "sticky" header instead of being hidden behind it. */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-paper pb-2.5 max-[1179px]:top-[69px]">
        <EditorTopBar
          resumeId={resume.id}
          jobTitle={resume.job_title}
          companyName={resume.company_name}
          isTailored={Boolean(resume.skills_bridge_id)}
          saveStatus={saveStatus}
          saveError={saveError}
          tab={tab}
          coverLetterExists={Boolean(coverLetter)}
          isGeneratingCoverLetter={isGeneratingCoverLetter}
          onToggleOrGenerateCoverLetter={() =>
            coverLetter ? setTab(tab === "cover-letter" ? "resume" : "cover-letter") : handleGenerateCoverLetter()
          }
          isTracked={isTracked}
          isTracking={isTracking}
          canTrack={Boolean(resume.company_name?.trim() && resume.job_title?.trim())}
          onTrackApplication={handleTrackApplication}
          onNewCoverLetter={COVER_LETTER_V1_ENABLED ? () => setIsNewCoverLetterOpen(true) : undefined}
        />
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
            profile={profile}
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
            setAtsScore={setAtsScore}
            isScoring={isScoring}
            onScoreResume={handleScoreResume}
            isUnlocked={isUnlocked}
            downloadingFormat={downloadingFormat}
            onDownload={handleDownload}
            onDownloadLocked={handleDownloadLocked}
            onSaveStatusChange={setSaveStatus}
            onSaveErrorChange={setSaveError}
          />
        )}

        {tab === "cover-letter" && coverLetter && resume.resume_content && (
          <div className="h-full overflow-y-auto">
            <CoverLetterPreview
              resumeId={resume.id}
              initialCoverLetter={coverLetter}
              contact={resume.resume_content.contact}
              companyName={resume.company_name}
              isPaidPlan={isPaidPlan}
              isUnlocked={isUnlocked}
              downloadingFormat={downloadingFormat}
              onDownload={handleDownload}
              onDownloadLocked={handleDownloadLocked}
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

      {COVER_LETTER_V1_ENABLED && (
        <NewCoverLetterModal
          isOpen={isNewCoverLetterOpen}
          onClose={() => setIsNewCoverLetterOpen(false)}
          initialResumeId={resume.id}
        />
      )}

      <LimitReachedModal
        isOpen={coverLetterLimitReached}
        onClose={() => setCoverLetterLimitReached(false)}
        title="You've used your free cover letters"
        message="Upgrade for unlimited cover letters, resumes, and downloads."
      />
    </div>
  );
}
