"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { OnboardingReviewForm } from "@/components/onboarding/OnboardingReviewForm";
import type { ProfileFieldsInitial } from "@/lib/profile/useProfileFieldsState";
import type { ParsedProfileFields, UserProfile } from "@/types";

type Step = "choose" | "resume" | "linkedin" | "review";

function parsedToInitial(parsed: ParsedProfileFields, fallbackFullName: string): ProfileFieldsInitial {
  return {
    fullName: parsed.fullName || fallbackFullName,
    work_rights: parsed.work_rights,
    phone: parsed.phone,
    location: parsed.location,
    linkedin_url: parsed.linkedin_url,
    skills: parsed.skills,
    work_experience: parsed.work_experience,
    education: parsed.education,
    referees: parsed.referees,
  };
}

export function OnboardingWizard({
  initialFullName,
  initialProfile,
}: {
  initialFullName: string;
  initialProfile: UserProfile | null;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [reviewInitial, setReviewInitial] = useState<ProfileFieldsInitial>({});
  const [linkedinText, setLinkedinText] = useState(initialProfile?.raw_linkedin_paste ?? "");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const scratchInitial: ProfileFieldsInitial = {
    fullName: initialFullName,
    work_rights: initialProfile?.work_rights,
    phone: initialProfile?.phone,
    location: initialProfile?.location,
    linkedin_url: initialProfile?.linkedin_url,
    skills: initialProfile?.skills,
    work_experience: initialProfile?.work_experience,
    education: initialProfile?.education,
    referees: initialProfile?.referees,
    raw_linkedin_paste: initialProfile?.raw_linkedin_paste,
  };

  function startFromScratch() {
    setReviewInitial(scratchInitial);
    setStep("review");
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setIsParsing(true);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/profile/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    setIsParsing(false);

    if (!response.ok) {
      setParseError(data.error ?? "We couldn't read that file — paste your text instead.");
      return;
    }

    setReviewInitial({
      ...parsedToInitial(data.profile as ParsedProfileFields, initialFullName),
      raw_linkedin_paste: initialProfile?.raw_linkedin_paste,
    });
    setStep("review");
  }

  async function handleLinkedinSubmit(event: React.FormEvent) {
    event.preventDefault();
    setParseError(null);
    setIsParsing(true);

    const response = await fetch("/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: linkedinText }),
    });
    const data = await response.json().catch(() => ({}));
    setIsParsing(false);

    if (!response.ok) {
      setParseError(data.error ?? "We couldn't extract anything from that text.");
      return;
    }

    setReviewInitial({
      ...parsedToInitial(data.profile as ParsedProfileFields, initialFullName),
      raw_linkedin_paste: linkedinText,
    });
    setStep("review");
  }

  if (step === "review") {
    return <OnboardingReviewForm initial={reviewInitial} />;
  }

  if (step === "resume") {
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Upload your resume</h2>
          <p className="mt-1 text-sm text-gray-500">PDF or Word doc, up to 5 MB.</p>
        </div>
        <label className="mx-auto flex w-full max-w-sm cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-8 text-sm text-gray-500 hover:border-brand-500">
          <span>{fileName ?? "Click to choose a file"}</span>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleResumeUpload}
            disabled={isParsing}
          />
        </label>
        {isParsing && <p className="text-sm text-gray-500">Reading your resume…</p>}
        {parseError && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-red-600">{parseError}</p>
            <button
              type="button"
              className="text-sm font-medium text-brand-600 hover:underline"
              onClick={() => {
                setParseError(null);
                setStep("linkedin");
              }}
            >
              Paste your text instead
            </button>
          </div>
        )}
        <div className="flex items-center justify-center gap-4 text-sm">
          <button type="button" className="text-gray-500 hover:underline" onClick={() => setStep("choose")}>
            Back
          </button>
          <button
            type="button"
            className="font-medium text-brand-600 hover:underline"
            onClick={startFromScratch}
          >
            Continue from scratch instead
          </button>
        </div>
      </div>
    );
  }

  if (step === "linkedin") {
    return (
      <form
        onSubmit={handleLinkedinSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-8"
      >
        <div>
          <h2 className="text-lg font-medium text-gray-900">Paste your LinkedIn profile</h2>
          <p className="mt-1 text-sm text-gray-500">
            Open your LinkedIn profile, select all the page text (Ctrl/Cmd+A), copy it, and paste it
            below.
          </p>
        </div>
        <Textarea
          rows={10}
          placeholder="Paste your LinkedIn profile text here..."
          value={linkedinText}
          onChange={(e) => setLinkedinText(e.target.value)}
          required
        />
        {parseError && <p className="text-sm text-red-600">{parseError}</p>}
        <div className="flex items-center gap-4">
          <Button type="submit" isLoading={isParsing}>
            Extract &amp; continue
          </Button>
          <button
            type="button"
            className="text-sm text-gray-500 hover:underline"
            onClick={() => setStep("choose")}
          >
            Back
          </button>
          <button
            type="button"
            className="text-sm font-medium text-brand-600 hover:underline"
            onClick={startFromScratch}
          >
            Continue from scratch instead
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => setStep("resume")}
        className="flex flex-col items-center gap-2 rounded-2xl border-2 border-brand-600 bg-brand-50 p-6 text-center hover:bg-brand-100"
      >
        <span className="text-base font-semibold text-brand-700">Import resume</span>
        <span className="text-sm text-brand-700/80">
          Upload a PDF or Word doc and we&apos;ll fill in the details.
        </span>
      </button>
      <button
        type="button"
        onClick={() => setStep("linkedin")}
        className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 text-center hover:bg-gray-50"
      >
        <span className="text-base font-semibold text-gray-900">Import from LinkedIn</span>
        <span className="text-sm text-gray-500">Paste your profile text and we&apos;ll extract it.</span>
      </button>
      <button
        type="button"
        onClick={startFromScratch}
        className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 text-center hover:bg-gray-50"
      >
        <span className="text-base font-semibold text-gray-900">Start from scratch</span>
        <span className="text-sm text-gray-500">Fill in your details manually.</span>
      </button>
    </div>
  );
}
