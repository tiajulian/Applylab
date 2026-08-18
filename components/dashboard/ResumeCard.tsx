"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Resume } from "@/types";

export function ResumeCard({ resume: initialResume }: { resume: Resume }) {
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
    <div className="relative flex flex-col gap-2 rounded border border-border bg-surface p-5 transition-transform duration-fast ease-editorial hover:-translate-y-0.5">
      <div ref={menuRef} className="absolute right-3 top-3">
        <button
          type="button"
          aria-label="Resume options"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-sm p-1 text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-36 rounded border border-border bg-surface py-1 shadow-pop">
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
        <Link href={`/resume/${resume.id}`} className="flex flex-col gap-2 pr-6">
          <span className="text-sm font-medium text-ink">
            {resume.job_title || "Untitled role"}
          </span>
          <span className="text-sm text-ink-secondary">{resume.company_name || "No company name"}</span>
          <div className="mt-2 flex flex-col gap-1.5 text-xs text-ink-muted">
            {/* timeZone pinned: created_at is a full timestamp, so without this the server (UTC) and
                a client past the UTC+10/11 boundary render different calendar days for the same
                instant - a text mismatch that fails hydration. applied_date elsewhere is date-only
                (parses to UTC midnight, never crosses that boundary for AU clients), which is why
                this card was the only one affected. */}
            <span>
              {new Date(resume.created_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <span
                title={resume.ats_score !== null ? undefined : "Not yet scored"}
                aria-label={resume.ats_score !== null ? `ATS score ${resume.ats_score}` : "ATS score: not yet scored"}
                className="whitespace-nowrap rounded-pill bg-paper-deep px-2 py-0.5 font-medium text-ink-secondary"
              >
                {resume.ats_score !== null ? `ATS ${resume.ats_score}` : "ATS —"}
              </span>
              <span
                title={resume.content_score !== null ? undefined : "Not yet scored"}
                aria-label={
                  resume.content_score !== null
                    ? `Content score ${resume.content_score}`
                    : "Content score: not yet scored"
                }
                className="whitespace-nowrap rounded-pill bg-paper-deep px-2 py-0.5 font-medium text-ink-secondary"
              >
                {resume.content_score !== null ? `Content ${resume.content_score}` : "Content —"}
              </span>
            </div>
          </div>
        </Link>
      )}
      <Link
        href={`/resume/${resume.id}/duplicate`}
        className="self-start text-xs font-medium text-accent transition-colors duration-fast ease-editorial hover:text-accent-hover hover:underline"
      >
        Duplicate &amp; tailor
      </Link>

      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  );
}
