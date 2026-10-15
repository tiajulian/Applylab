"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { DocumentListResume } from "@/types";
import { MoreHorizontalIcon } from "@/components/ui/icons/LucideIcons";

export function ResumeCard({ resume: initialResume }: { resume: DocumentListResume }) {
  const [resume, setResume] = useState(initialResume);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(resume.job_title ?? "");
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    const response = await fetch(`/api/resume/${resume.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
      setError(data.error ?? "Failed to delete resume");
      return;
    }

    setIsDeleted(true);
  }

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Give this resume a title");
      return;
    }

    setIsSavingRename(true);
    setRenameError(null);

    const response = await fetch(`/api/resume/${resume.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_title: trimmed }),
    });
    const data = await response.json().catch(() => ({}));
    setIsSavingRename(false);

    if (!response.ok) {
      setRenameError(data.error ?? "Failed to rename resume");
      return;
    }

    setResume(data.resume);
    setIsRenaming(false);
  }

  if (isDeleted) return null;


  return (
    <div className="relative flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-5 shadow-sm transition-[transform,box-shadow] duration-fast ease-editorial hover:-translate-y-0.5 hover:shadow">
      <div ref={menuRef} className="absolute right-3 top-3">
        <button
          type="button"
          aria-label="More options for this resume"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-sm p-1 text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontalIcon className="h-[18px] w-[18px] rotate-90" />
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-pop">
            <Link
              href={`/resume/${resume.id}/review`}
              className="block w-full px-3 py-2 text-left text-sm text-ink transition-colors duration-fast ease-editorial hover:bg-paper-deep"
              onClick={() => setIsMenuOpen(false)}
            >
              Check &amp; improve
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setRenameValue(resume.job_title ?? "");
                setRenameError(null);
                setIsRenaming(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-ink transition-colors duration-fast ease-editorial hover:bg-paper-deep"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsConfirmingDelete(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-critical transition-colors duration-fast ease-editorial hover:bg-critical-soft"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {isConfirmingDelete && (
        <ConfirmDialog
          title={`Delete ${resume.job_title || "this resume"}?`}
          description="This can't be undone."
          confirmLabel={isDeleting ? "Deleting…" : "Delete"}
          isDestructive
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}

      {isRenaming ? (
        <div className="flex flex-col gap-2 pr-6">
          <Input
            id={`rename-${resume.id}`}
            aria-label="Resume title"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
          />
          {renameError && <p className="text-xs text-critical">{renameError}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleRename} isLoading={isSavingRename}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsRenaming(false)} disabled={isSavingRename}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Link href={`/resume/${resume.id}`} className="flex flex-1 flex-col gap-1 pr-7">
          <span className="text-[15px] font-semibold text-ink">{resume.job_title || "General resume"}</span>
          {resume.company_name && <span className="text-[13.5px] text-ink-secondary">{resume.company_name}</span>}
          <span className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[12.5px] text-ink-muted">
            {/* timeZone pinned: created_at is a full timestamp, so without this the server (UTC) and
                a client past the UTC+10/11 boundary render different calendar days for the same
                instant - a text mismatch that fails hydration. */}
            <span>{new Date(resume.created_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}</span>
            {resume.ats_score !== null && (
              <span
                title="How easily hiring software (ATS) can read this resume"
                className="whitespace-nowrap rounded-pill bg-paper-deep px-2 py-0.5 font-semibold tabular-nums text-ink-secondary"
              >
                Readability {resume.ats_score}/100
              </span>
            )}
            {resume.review_overall_score != null && (
              <span
                title="Score from Check & improve"
                className="whitespace-nowrap rounded-pill bg-accent-soft px-2 py-0.5 font-semibold tabular-nums text-accent-hover"
              >
                Review {resume.review_overall_score}/100
              </span>
            )}
          </span>
        </Link>
      )}
      <div className="flex items-center gap-4 border-t border-border pt-3">
        <Link
          href={`/resume/${resume.id}/review`}
          className="text-[13px] font-semibold text-accent-hover transition-colors duration-fast ease-editorial hover:underline"
        >
          Check &amp; improve
        </Link>
        <Link
          href={`/resume/${resume.id}/duplicate`}
          className="text-[13px] font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:text-ink hover:underline"
        >
          Copy for another job
        </Link>
      </div>

      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  );
}
