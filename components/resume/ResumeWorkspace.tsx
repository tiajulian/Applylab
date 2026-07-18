"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ResumePreview } from "@/components/resume/ResumePreview";
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleDownloadPdf() {
    if (!isPaidPlan) {
      router.push("/upgrade");
      return;
    }

    setError(null);
    setIsDownloading(true);

    const response = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeId: resume.id, type: tab === "resume" ? "resume" : "cover-letter" }),
    });

    setIsDownloading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to generate PDF");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${resume.job_title ?? "resume"}-${tab}.pdf`;
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
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadPdf}
            isLoading={isDownloading}
            title={isPaidPlan ? undefined : "Upgrade to download PDFs"}
          >
            {isPaidPlan ? "Download PDF" : "Download PDF (Pro)"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {atsScore !== null && <ATSScore score={atsScore} missingKeywords={missingKeywords} />}

      {tab === "resume" && resume.resume_content && <ResumePreview resume={resume.resume_content} />}
      {tab === "cover-letter" && coverLetter && <CoverLetterPreview coverLetter={coverLetter} />}
    </div>
  );
}
