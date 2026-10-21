"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { CoverLetterCard } from "@/components/documents/CoverLetterCard";
import { CoverLetterHub, type CoverLetterListItem } from "@/components/coverLetter/CoverLetterHub";
import { NewCoverLetterModal } from "@/components/coverLetter/NewCoverLetterModal";
import { PlusIcon } from "@/components/ui/icons/LucideIcons";
import { QUOTA_COPY } from "@/lib/copy";
import { useQueryFlag } from "@/lib/hooks/useQueryFlag";
import type { Plan, DocumentListResume } from "@/types";

/**
 * Step 2 of the job hunt, part one: every tailored resume. Cover letters have their own page
 * (CoverLettersView at /cover-letter) - people couldn't find them behind a tab here.
 */
export function ResumesView({
  resumes,
  plan,
  remaining,
  freeLimit,
  limitReached,
}: {
  resumes: DocumentListResume[];
  plan: Plan;
  remaining: number;
  freeLimit: number;
  limitReached: boolean;
}) {
  const newResumeButton = limitReached ? (
    <Button href="/upgrade">Get unlimited resumes</Button>
  ) : (
    <Button href="/resume/new">
      <PlusIcon className="h-4 w-4" /> Tailor a new resume
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        step={2}
        title="Resumes"
        subtitle={
          <>
            Paste a job ad and ApplyLab writes a resume for that job, using only your profile.
            {plan === "free" && (
              <span className="mt-1 block text-[13.5px] text-ink-muted">{QUOTA_COPY.remaining(remaining, freeLimit)}</span>
            )}
          </>
        }
        // The empty state carries its own button; showing both would put two identical
        // primary actions on screen.
        action={resumes.length > 0 && newResumeButton}
      />

      {resumes.length === 0 ? (
        <EmptyState
          title="No resumes yet"
          body="Copy a job ad from SEEK or LinkedIn, paste it in, and get a resume written for that job (one page for most people)."
          action={newResumeButton}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => (
            <li key={resume.id}>
              <ResumeCard resume={resume} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Step 2 of the job hunt, part two: every cover letter, both standalone ones and ones written
 * alongside a resume, so there's a single answer to "where are my letters?".
 */
export function CoverLettersView({
  letters,
  resumeLetters,
}: {
  letters: CoverLetterListItem[];
  /** Resumes that carry a matching cover letter. */
  resumeLetters: DocumentListResume[];
}) {
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  // ?new=1 (the dashboard's "Write a cover letter" shortcut) opens the letter form.
  useQueryFlag("new", () => setIsLetterModalOpen(true));

  const letterCount = letters.length + resumeLetters.length;
  const newLetterButton = (
    <Button type="button" onClick={() => setIsLetterModalOpen(true)}>
      <PlusIcon className="h-4 w-4" /> Write a cover letter
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        step={2}
        title="Cover letters"
        subtitle="Paste a job ad and ApplyLab writes a cover letter for that job, starting from your resume and profile."
        action={letterCount > 0 && newLetterButton}
      />

      {letterCount === 0 ? (
        <EmptyState
          title="No cover letters yet"
          body="Write one for a job ad, starting from your resume, or open a resume and add a matching letter."
          action={newLetterButton}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {letters.length > 0 && <CoverLetterHub letters={letters} />}
          {resumeLetters.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {resumeLetters.map((resume) => (
                <li key={resume.id}>
                  <CoverLetterCard resume={resume} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <NewCoverLetterModal isOpen={isLetterModalOpen} onClose={() => setIsLetterModalOpen(false)} />
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14 text-center">
      <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
      <p className="max-w-[44ch] text-[14.5px] leading-relaxed text-ink-secondary">{body}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}
