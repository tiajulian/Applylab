"use client";

import Link from "next/link";
import type { Resume } from "@/types";

export function CoverLetterCard({ resume }: { resume: Resume }) {
  const content = resume.cover_letter_content?.trim() ?? "";
  // Strip potential Markdown headers or take the first clean paragraph as a preview snippet
  const previewSnippet = content
    .replace(/^#+\s+.*$/gm, "")
    .replace(/\n+/g, " ")
    .trim();

  return (
    <div className="relative flex flex-col justify-between gap-4 rounded border border-border bg-surface p-5 transition-transform duration-fast ease-editorial hover:-translate-y-0.5">
      <Link
        href={`/resume/${resume.id}?tab=cover-letter`}
        className="flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-ink">
              {resume.job_title || "Untitled role"}
            </span>
            <p className="text-sm text-ink-secondary">
              {resume.company_name || "No company name"}
            </p>
          </div>
          <span className="shrink-0 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
            Cover letter
          </span>
        </div>

        {previewSnippet && (
          <p className="mt-1 line-clamp-3 text-xs text-ink-muted leading-relaxed">
            {previewSnippet}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
          <span>
            {new Date(resume.created_at).toLocaleDateString("en-AU", {
              timeZone: "Australia/Sydney",
            })}
          </span>
          {resume.skills_bridge_id && (
            <>
              <span>&middot;</span>
              <span className="text-accent">Skills Bridge tailored</span>
            </>
          )}
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <Link
          href={`/resume/${resume.id}?tab=cover-letter`}
          className="text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent-hover hover:underline"
        >
          Open cover letter &rarr;
        </Link>
        <Link
          href={`/resume/${resume.id}`}
          className="text-xs text-ink-muted transition-colors duration-fast ease-editorial hover:text-ink-secondary hover:underline"
        >
          View resume
        </Link>
      </div>
    </div>
  );
}
