"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ResumeCard } from "@/components/dashboard/ResumeCard";
import { CoverLetterCard } from "@/components/documents/CoverLetterCard";
import { Reveal } from "@/components/ui/Reveal";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import type { Plan, Resume } from "@/types";

export function DocumentsView({
  resumes,
  plan,
  remaining,
  freeLimit,
  limitReached,
  initialView = "resumes",
}: {
  resumes: Resume[];
  plan: Plan;
  remaining: number;
  freeLimit: number;
  limitReached: boolean;
  initialView?: "resumes" | "cover-letters";
}) {
  const [view, setView] = useState<"resumes" | "cover-letters">(initialView);

  const coverLetterResumes = resumes.filter(
    (resume) => Boolean(resume.cover_letter_content?.trim())
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Header with Title, Counter, and CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 text-ink">Documents</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {plan === "free"
              ? `${remaining} of ${freeLimit} free resumes remaining`
              : "Unlimited resumes on your plan"}
          </p>
        </div>
        {limitReached ? (
          <Link href="/upgrade">
            <Button>Upgrade to continue</Button>
          </Link>
        ) : (
          <Link href="/resume/new">
            <Button>New resume</Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setView("resumes")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-fast ease-editorial ${
            view === "resumes"
              ? "border-accent text-accent"
              : "border-transparent text-ink-secondary hover:border-border-strong hover:text-ink"
          }`}
        >
          <span>Resumes</span>
          <span
            className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
              view === "resumes"
                ? "bg-accent-soft text-accent"
                : "bg-paper-deep text-ink-muted"
            }`}
          >
            {resumes.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setView("cover-letters")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-fast ease-editorial ${
            view === "cover-letters"
              ? "border-accent text-accent"
              : "border-transparent text-ink-secondary hover:border-border-strong hover:text-ink"
          }`}
        >
          <span>Cover letters</span>
          <span
            className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
              view === "cover-letters"
                ? "bg-accent-soft text-accent"
                : "bg-paper-deep text-ink-muted"
            }`}
          >
            {coverLetterResumes.length}
          </span>
        </button>
      </div>

      {/* Resumes View */}
      {view === "resumes" && (
        <>
          {resumes.length === 0 ? (
            <Reveal>
              <div className="rounded border border-dashed border-border-strong bg-surface p-12 text-center">
                <h2 className="font-display text-h3 text-ink">No resumes yet</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Paste a job description and we&apos;ll build you a SEEK-ready resume.
                </p>
                <Link href="/resume/new" className="mt-4 inline-block">
                  <Button>Create your first resume</Button>
                </Link>
              </div>
            </Reveal>
          ) : (
            <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resumes.map((resume) => (
                <StaggerItem key={resume.id}>
                  <ResumeCard resume={resume} />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </>
      )}

      {/* Cover Letters View */}
      {view === "cover-letters" && (
        <>
          {coverLetterResumes.length === 0 ? (
            <Reveal>
              <div className="rounded border border-dashed border-border-strong bg-surface p-12 text-center">
                <h2 className="font-display text-h3 text-ink">No cover letters yet</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink-secondary">
                  Cover letters are tailored alongside your resumes in the resume workspace.
                  Open any resume and generate a matching cover letter.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  {resumes.length > 0 ? (
                    <Button variant="secondary" onClick={() => setView("resumes")}>
                      View your resumes
                    </Button>
                  ) : (
                    <Link href="/resume/new">
                      <Button>Create your first resume</Button>
                    </Link>
                  )}
                </div>
              </div>
            </Reveal>
          ) : (
            <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coverLetterResumes.map((resume) => (
                <StaggerItem key={resume.id}>
                  <CoverLetterCard resume={resume} />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </>
      )}
    </div>
  );
}
