import Link from "next/link";
import type { DocumentListResume } from "@/types";

/** A cover letter written alongside a resume; it opens in that resume's workspace. */
export function CoverLetterCard({ resume }: { resume: DocumentListResume }) {
  const previewSnippet = (resume.cover_letter_content?.trim() ?? "")
    .replace(/^#+\s+.*$/gm, "")
    .replace(/\n+/g, " ")
    .trim();

  return (
    <Link
      href={`/resume/${resume.id}?tab=cover-letter`}
      className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-5 shadow-sm transition-[transform,box-shadow] duration-fast ease-editorial hover:-translate-y-0.5 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-[15px] font-semibold text-ink">{resume.job_title || "Cover letter"}</span>
      {resume.company_name && <span className="text-[13.5px] text-ink-secondary">{resume.company_name}</span>}
      {previewSnippet && (
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-muted">{previewSnippet}</p>
      )}
      <span className="mt-auto pt-3 text-[12.5px] text-ink-muted">
        With your resume &middot;{" "}
        {new Date(resume.created_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}
      </span>
    </Link>
  );
}
