"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { NewCoverLetterModal } from "@/components/coverLetter/NewCoverLetterModal";
import { PlusIcon } from "@/components/ui/icons/LucideIcons";

export interface CoverLetterListItem {
  id: string;
  title: string;
  company: string;
  created_via: "ai" | "blank";
  word_count: number;
  updated_at: string;
}

export function CoverLetterHub({ letters }: { letters: CoverLetterListItem[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setIsModalOpen(true)}>
          <PlusIcon className="h-4 w-4" /> New cover letter
        </Button>
      </div>

      {letters.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded border border-dashed border-border-strong px-6 py-16 text-center">
          <h2 className="font-display text-h3 text-ink">Write your first cover letter</h2>
          <p className="max-w-sm text-sm text-ink-secondary">
            Start from your resume and a job ad, or write one from scratch.
          </p>
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            New cover letter
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {letters.map((letter) => (
            <li key={letter.id}>
              <Link
                href={`/cover-letter/${letter.id}`}
                className="flex h-full flex-col gap-2 rounded border border-border bg-surface p-5 transition-transform duration-fast ease-editorial hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-medium text-ink">{letter.title}</span>
                {letter.company && <span className="text-sm text-ink-secondary">{letter.company}</span>}
                <span className="mt-auto flex items-center gap-2 pt-2 text-xs text-ink-muted">
                  <span>{letter.word_count} words</span>
                  <span>&middot;</span>
                  <span>
                    Edited{" "}
                    {new Date(letter.updated_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}
                  </span>
                  {letter.created_via === "ai" && (
                    <span className="ml-auto rounded-pill bg-accent-soft px-2 py-0.5 font-semibold text-accent">AI draft</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewCoverLetterModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
