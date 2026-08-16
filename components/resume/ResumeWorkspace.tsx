"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { CoverLetterPreview } from "@/components/resume/CoverLetterPreview";
import { ATSScore } from "@/components/resume/ATSScore";
import { ReviewBeforeExportModal } from "@/components/resume/ReviewBeforeExportModal";
import { NeedsReviewBanner } from "@/components/resume/NeedsReviewBanner";
import { useProgressMessages } from "@/lib/hooks/useProgressMessages";
import type { ContentScoreBreakdown, ContentScoreIssue, FactCheckFlag, Resume } from "@/types";

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
      }))
    );
}

type Tab = "resume" | "cover-letter";

const COVER_LETTER_MESSAGES = [
  "Reading your resume…",
  "Drafting your cover letter…",
  "Almost done…",
];

export function ResumeWorkspace({ resume, isPaidPlan }: { resume: Resume; isPaidPlan: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resume");
  const [coverLetter, setCoverLetter] = useState(resume.cover_letter_content);
  const [atsScore, setAtsScore] = useState(resume.ats_score);
  const [missingKeywords, setMissingKeywords] = useState(resume.missing_keywords ?? []);
  // Lifted up from ResumeEditor (rather than owned there) so the paid "Score resume" action
  // below can update both the ATS and content-quality halves of a combined score in one place —
  // see /api/resume/[id]/score. Free users still update these via ResumeEditor's own
  // content-score call, passed the setters as props.
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
  const [error, setError] = useState<string | null>(null);
  // Gate the first export per page load behind an explicit "I've reviewed it" confirmation —
  // repeat downloads in the same session don't need to re-prompt.
  const [hasConfirmedExport, setHasConfirmedExport] = useState(false);
  const [pendingDownloadFormat, setPendingDownloadFormat] = useState<"pdf" | "docx" | null>(null);
  const coverLetterProgressMessage = useProgressMessages(COVER_LETTER_MESSAGES, isGeneratingCoverLetter);

  // Close the download menu if the user switches tabs while it's open, rather than leaving it
  // floating over content it no longer applies to.
  useEffect(() => {
    setIsDownloadMenuOpen(false);
  }, [tab]);

  async function handleGenerateCoverLetter() {
    setError(null);
    setIsGeneratingCoverLetter(true);

    // Wrapped so a network failure or non-JSON response (e.g. a platform timeout page) can't
    // leave the loading state stuck true forever with no error shown — see ResumeForm.tsx for
    // the production incident this pattern caused.
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

  // Combines what used to be two separate actions (ATS score, content score) into one paid-only
  // request - see /api/resume/[id]/score. Free users are redirected to upgrade before any call,
  // same as the old ATS-only button; their content-score button lives in ResumeEditor unchanged.
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
      // The server only reserves/increments content_score_count on an actual fresh score - a
      // cache-hit response (fromCache: true) means the count didn't change server-side, so don't
      // drift the locally-displayed count out of sync with it.
      if (!data.fromCache) {
        setContentScoreCount((count) => count + 1);
      }
    } catch {
      setError("Something went wrong, and the request may have timed out. Please try again.");
    } finally {
      setIsScoring(false);
    }
  }

  function handleDownload(format: "pdf" | "docx") {
    if (!isPaidPlan) {
      router.push("/upgrade");
      return;
    }

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

    // Wrapped so a network failure before any response arrives can't leave downloadingFormat
    // stuck non-null forever with no error shown — see ResumeForm.tsx for the production
    // incident this pattern caused.
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

  function handleConfirmExport() {
    setHasConfirmedExport(true);
    const format = pendingDownloadFormat;
    setPendingDownloadFormat(null);
    if (format) void performDownload(format);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tab === "resume" ? "primary" : "outline"}
            size="sm"
            onClick={() => setTab("resume")}
          >
            Resume
          </Button>
          <Button
            type="button"
            variant={tab === "cover-letter" ? "primary" : "outline"}
            size="sm"
            onClick={() => (coverLetter ? setTab("cover-letter") : handleGenerateCoverLetter())}
            isLoading={isGeneratingCoverLetter}
          >
            {coverLetter ? "Cover letter" : "Generate cover letter"}
          </Button>
          <Link href={`/resume/${resume.id}/duplicate`}>
            <Button type="button" variant="ghost" size="sm">
              Duplicate &amp; tailor
            </Button>
          </Link>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleScoreResume}
            isLoading={isScoring}
            title={isPaidPlan ? undefined : "Upgrade to score your resume"}
          >
            {atsScore !== null ? "Re-score resume" : isPaidPlan ? "Score resume" : "Score resume (Pro)"}
          </Button>
          <div className="relative">
            <Button
              type="button"
              size="sm"
              onClick={() => (isPaidPlan ? setIsDownloadMenuOpen((open) => !open) : router.push("/upgrade"))}
              isLoading={downloadingFormat !== null}
              title={isPaidPlan ? undefined : "Upgrade to download"}
            >
              {isPaidPlan ? "Download ▾" : "Download (Pro)"}
            </Button>
            <AnimatePresence>
              {isDownloadMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute right-0 z-10 mt-1 flex w-36 flex-col gap-0.5 rounded border border-border bg-surface p-1.5 shadow-pop"
                >
                  <button
                    type="button"
                    className="rounded px-3 py-1.5 text-left text-sm text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleDownload("pdf")}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    className="rounded px-3 py-1.5 text-left text-sm text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleDownload("docx")}
                  >
                    Word (.docx)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}
      {isGeneratingCoverLetter && <p className="text-sm text-ink-muted">{coverLetterProgressMessage}</p>}

      {tab === "resume" && <NeedsReviewBanner gateResult={resume.gate_result} />}

      {tab === "resume" && atsScore !== null && <ATSScore score={atsScore} missingKeywords={missingKeywords} />}

      {tab === "resume" && resume.resume_content && (
        <ResumeEditor
          resumeId={resume.id}
          initialResumeContent={resume.resume_content}
          initialTemplate={resume.template}
          isPaidPlan={isPaidPlan}
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
        <CoverLetterPreview
          resumeId={resume.id}
          initialCoverLetter={coverLetter}
          contact={resume.resume_content.contact}
        />
      )}

      {pendingDownloadFormat && (
        <ReviewBeforeExportModal
          // Defensive: bridge_fact_check_flags is a newer column - a schema migration that
          // hasn't been applied/backfilled yet on a given database would make this key missing
          // rather than an empty array, and spreading undefined throws.
          flags={[...(resume.fact_check_flags ?? []), ...(resume.bridge_fact_check_flags ?? []), ...gateFlagsFor(resume)]}
          onConfirm={handleConfirmExport}
          onCancel={() => setPendingDownloadFormat(null)}
        />
      )}
    </div>
  );
}
