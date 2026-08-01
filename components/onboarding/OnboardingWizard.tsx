"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { OnboardingReviewForm } from "@/components/onboarding/OnboardingReviewForm";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { EASE } from "@/lib/motion";
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
  const reduceMotion = useReducedMotion();

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
      setParseError(data.error ?? "We couldn't read that file. Paste your text instead.");
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

  const stepTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: EASE };

  return (
    <AnimatePresence mode="wait">
      {step === "resume" && (
        <motion.div
          key="resume"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={stepTransition}
          className="flex flex-col gap-6 rounded border border-border bg-surface p-8 text-center"
        >
          <div>
            <h2 className="text-h3 font-semibold text-ink">Upload your resume</h2>
            <p className="mt-1 text-sm text-ink-secondary">PDF or Word doc, up to 5 MB.</p>
          </div>
          <label className="mx-auto flex w-full max-w-sm cursor-pointer flex-col items-center gap-2 rounded border-2 border-dashed border-border-strong p-8 text-sm text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent">
            <span>{fileName ?? "Click to choose a file"}</span>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={isParsing}
            />
          </label>
          {isParsing && <p className="text-sm text-ink-secondary">Reading your resume…</p>}
          {parseError && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-critical">{parseError}</p>
              <button
                type="button"
                className="rounded text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <button
              type="button"
              className="rounded text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setStep("choose")}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={startFromScratch}
            >
              Continue from scratch instead
            </button>
          </div>
        </motion.div>
      )}

      {step === "linkedin" && (
        <motion.form
          key="linkedin"
          onSubmit={handleLinkedinSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={stepTransition}
          className="flex flex-col gap-4 rounded border border-border bg-surface p-8"
        >
          <div>
            <h2 className="text-h3 font-semibold text-ink">Paste your LinkedIn profile</h2>
            <p className="mt-1 text-sm text-ink-secondary">
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

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <label className="flex cursor-pointer flex-col items-center gap-1 rounded border-2 border-dashed border-border-strong p-4 text-center text-sm text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent">
            <span>
              {fileName ?? "Upload the PDF LinkedIn generates for you"}
            </span>
            <span className="text-xs text-ink-muted">
              On your LinkedIn profile: the &ldquo;&hellip;&rdquo; menu next to Contact info &rarr; Save to PDF
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={isParsing}
            />
          </label>

          {parseError && <p className="text-sm text-critical">{parseError}</p>}
          <div className="flex items-center gap-4">
            <Button type="submit" isLoading={isParsing}>
              Extract &amp; continue
            </Button>
            <button
              type="button"
              className="rounded text-sm text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setStep("choose")}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={startFromScratch}
            >
              Continue from scratch instead
            </button>
          </div>
        </motion.form>
      )}

      {step === "choose" && (
        <motion.div
          key="choose"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={stepTransition}
        >
          <StaggerList className="grid gap-4 sm:grid-cols-3">
            <StaggerItem>
              <button
                type="button"
                onClick={() => setStep("resume")}
                className="flex h-full w-full flex-col items-center gap-2 rounded border-2 border-accent bg-accent-soft p-6 text-center transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-accent-soft/80 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-accent">Import resume</span>
                <span className="text-sm text-accent/80">
                  Upload a PDF or Word doc and we&apos;ll fill in the details.
                </span>
              </button>
            </StaggerItem>
            <StaggerItem>
              <button
                type="button"
                onClick={() => setStep("linkedin")}
                className="flex h-full w-full flex-col items-center gap-2 rounded border border-border bg-surface p-6 text-center transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-paper-deep active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-ink">Import from LinkedIn</span>
                <span className="text-sm text-ink-secondary">Paste your profile text and we&apos;ll extract it.</span>
              </button>
            </StaggerItem>
            <StaggerItem>
              <button
                type="button"
                onClick={startFromScratch}
                className="flex h-full w-full flex-col items-center gap-2 rounded border border-border bg-surface p-6 text-center transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-paper-deep active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-ink">Start from scratch</span>
                <span className="text-sm text-ink-secondary">Fill in your details manually.</span>
              </button>
            </StaggerItem>
          </StaggerList>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
