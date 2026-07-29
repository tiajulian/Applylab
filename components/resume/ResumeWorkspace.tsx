"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { CoverLetterPreview } from "@/components/resume/CoverLetterPreview";
import { ATSScore } from "@/components/resume/ATSScore";
import type { Resume } from "@/types";

type Tab = "resume" | "cover-letter";

export function ResumeWorkspace({ resume, isPaidPlan }: { resume: Resume; isPaidPlan: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resume");
  const [coverLetter, setCoverLetter] = useState(resume.cover_letter_content);
  const [atsScore, setAtsScore] = useState(resume.ats_score);
  const [missingKeywords, setMissingKeywords] = useState(resume.missing_keywords ?? []);

  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<"pdf" | "docx" | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close the download menu if the user switches tabs while it's open, rather than leaving it
  // floating over content it no longer applies to.
  useEffect(() => {
    setIsDownloadMenuOpen(false);
  }, [tab]);

  async function handleGenerateCoverLetter() {
    setError(null);
    setIsGeneratingCoverLetter(true);

    const response = await fetch("/api/generate-cover-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: resume.id }),
    });

    const data = await response.json();
    setIsGeneratingCoverLetter(false);

    if (!response.ok) {
      setError(data.error ?? "Failed to generate cover letter");
      return;
    }

    setCoverLetter(data.coverLetter);
    setTab("cover-letter");
  }

  async function handleScoreATS() {
    if (!isPaidPlan) {
      router.push("/upgrade");
      return;
    }

    setError(null);
    setIsScoring(true);

    const response = await fetch("/api/ats-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: resume.id }),
    });

    const data = await response.json();
    setIsScoring(false);

    if (!response.ok) {
      if (response.status === 403) {
        router.push("/upgrade");
        return;
      }
      setError(data.error ?? "Failed to score resume");
      return;
    }

    setAtsScore(data.result.score);
    setMissingKeywords(data.result.missing_keywords);
  }

  async function handleDownload(format: "pdf" | "docx") {
    if (!isPaidPlan) {
      router.push("/upgrade");
      return;
    }

    setIsDownloadMenuOpen(false);
    setError(null);
    setDownloadingFormat(format);

    const endpoint = format === "pdf" ? "/api/generate-pdf" : "/api/generate-docx";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: resume.id, type: tab === "resume" ? "resume" : "cover-letter" }),
    });

    setDownloadingFormat(null);

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
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleScoreATS}
            isLoading={isScoring}
            title={isPaidPlan ? undefined : "Upgrade to score ATS match"}
          >
            {atsScore !== null ? `Re-score ATS` : isPaidPlan ? "Score ATS match" : "Score ATS match (Pro)"}
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
            {isDownloadMenuOpen && (
              <div className="absolute right-0 z-10 mt-1 flex w-36 flex-col gap-0.5 rounded-lg border border-gray-200 bg-white p-1.5 shadow-md">
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => handleDownload("pdf")}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => handleDownload("docx")}
                >
                  Word (.docx)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {atsScore !== null && <ATSScore score={atsScore} missingKeywords={missingKeywords} />}

      {tab === "resume" && resume.resume_content && (
        <ResumeEditor
          resumeId={resume.id}
          initialResumeContent={resume.resume_content}
          initialTemplate={resume.template}
          isPaidPlan={isPaidPlan}
        />
      )}
      {tab === "cover-letter" && coverLetter && <CoverLetterPreview coverLetter={coverLetter} />}
    </div>
  );
}
