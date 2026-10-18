"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { CoverLetterCard } from "@/components/documents/CoverLetterCard";
import { CoverLetterHub, type CoverLetterListItem } from "@/components/coverLetter/CoverLetterHub";
import { NewCoverLetterModal } from "@/components/coverLetter/NewCoverLetterModal";
import { PlusIcon } from "@/components/ui/icons/LucideIcons";
import { QUOTA_COPY } from "@/lib/copy";
import { CTA } from "@/lib/marketing/copy";
import { useQueryFlag } from "@/lib/hooks/useQueryFlag";
import type { Plan, DocumentListResume } from "@/types";

type View = "resumes" | "cover-letters";

/**
 * Step 2 of the job hunt: every resume and cover letter in one place. Cover letters used to
 * live on two separate pages (ones written with a resume here, standalone ones at /cover-letter);
 * both now sit under one tab so there's a single answer to "where are my letters?".
 */
export function DocumentsView({
  resumes,
  letters,
  plan,
  remaining,
  freeLimit,
  limitReached,
  initialView = "resumes",
}: {
  resumes: DocumentListResume[];
  letters: CoverLetterListItem[];
  plan: Plan;
  remaining: number;
  freeLimit: number;
  limitReached: boolean;
  initialView?: View;
}) {
  const searchParams = useSearchParams();
  const viewParam: View = searchParams?.get("view") === "cover-letters" ? "cover-letters" : "resumes";
  const [view, setViewState] = useState<View>(initialView);

  // Keep the tab in the URL so Back, refresh and links to ?view=cover-letters all land on it.
  useEffect(() => setViewState(viewParam), [viewParam]);
  function setView(next: View) {
    setViewState(next);
    // Native history (null state, so Next syncs its router - see lib/url/dropSearchParam.ts), not
    // router.replace: switching tabs needs no fresh server data.
    window.history.replaceState(null, "", next === "cover-letters" ? "/documents?view=cover-letters" : "/documents");
  }
  const [isLetterModalOpen, setIsLetterModalOpen] = useState(false);
  // ?new=1 (the dashboard's "Write a cover letter" shortcut) opens the letter form.
  useQueryFlag("new", () => setIsLetterModalOpen(true));

  const resumeLetters = resumes.filter((resume) => Boolean(resume.cover_letter_content?.trim()));
  const letterCount = letters.length + resumeLetters.length;

  const newResumeButton = limitReached ? (
    <Button href="/upgrade">{CTA.goPro} to tailor more</Button>
  ) : (
    <Button href="/resume/new">
      <PlusIcon className="h-4 w-4" /> Tailor a new resume
    </Button>
  );
  const newLetterButton = (
    <Button type="button" onClick={() => setIsLetterModalOpen(true)}>
      <PlusIcon className="h-4 w-4" /> Write a cover letter
    </Button>
  );

  const tabs: { id: View; label: string; count: number }[] = [
    { id: "resumes", label: "Resumes", count: resumes.length },
    { id: "cover-letters", label: "Cover letters", count: letterCount },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        step={2}
        title="Resumes & letters"
        subtitle={
          <>
            Paste a job ad and ApplyLab writes a resume or cover letter for that job, using only your profile.
            {plan === "free" && (
              <span className="mt-1 block text-[13.5px] text-ink-muted">{QUOTA_COPY.remaining(remaining, freeLimit)}</span>
            )}
          </>
        }
        // The empty state carries its own button; showing both would put two identical
        // primary actions on screen.
        action={
          view === "resumes"
            ? resumes.length > 0 && newResumeButton
            : letterCount > 0 && newLetterButton
        }
      />

      <div role="tablist" aria-label="Document type" className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const selected = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setView(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[15px] transition-colors duration-fast ease-editorial ${
                selected
                  ? "border-accent font-semibold text-ink"
                  : "border-transparent font-medium text-ink-secondary hover:text-ink"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-pill px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
                  selected ? "bg-accent-soft text-accent-hover" : "bg-paper-deep text-ink-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {view === "resumes" &&
        (resumes.length === 0 ? (
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
        ))}

      {view === "cover-letters" &&
        (letterCount === 0 ? (
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
        ))}

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
