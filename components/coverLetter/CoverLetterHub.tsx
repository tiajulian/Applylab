"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MoreHorizontalIcon } from "@/components/ui/icons/LucideIcons";
import { useToast } from "@/components/ui/Toast";
import { displayLetterTitle } from "@/lib/coverLetter/content";

export interface CoverLetterListItem {
  id: string;
  title: string;
  company: string;
  word_count: number;
  updated_at: string;
}

/** Standalone cover letters (written on their own, not alongside a resume). */
export function CoverLetterHub({ letters }: { letters: CoverLetterListItem[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {letters.map((letter) => (
        <li key={letter.id}>
          <LetterCard letter={letter} />
        </li>
      ))}
    </ul>
  );
}

/** Same layout and ⋯ menu (rename, delete) as ResumeCard. */
function LetterCard({ letter: initialLetter }: { letter: CoverLetterListItem }) {
  const { showToast } = useToast();
  const [letter, setLetter] = useState(initialLetter);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = displayLetterTitle(letter.title, letter.company);

  useEffect(() => {
    if (!isMenuOpen) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMenuOpen]);

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    setIsSaving(true);
    const response = await fetch(`/api/cover-letters/${letter.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => null);
    setIsSaving(false);
    if (!response?.ok) {
      showToast("Couldn't rename it. Try again.", "critical");
      return;
    }
    setLetter((prev) => ({ ...prev, title: trimmed }));
    setIsRenaming(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    const response = await fetch(`/api/cover-letters/${letter.id}`, { method: "DELETE" }).catch(() => null);
    setIsDeleting(false);
    setIsConfirmingDelete(false);
    if (!response?.ok) {
      showToast("Couldn't delete it. Try again.", "critical");
      return;
    }
    setIsDeleted(true);
  }

  if (isDeleted) return null;

  return (
    <div className="relative flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-5 shadow-sm transition-[transform,box-shadow] duration-fast ease-editorial hover:-translate-y-0.5 hover:shadow">
      <div ref={menuRef} className="absolute right-3 top-3">
        <button
          type="button"
          aria-label="More options for this cover letter"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-sm p-1 text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontalIcon className="h-[18px] w-[18px] rotate-90" />
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-pop">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setRenameValue(letter.title);
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
          title={`Delete ${title}?`}
          description="This cover letter will be removed. This can't be undone."
          confirmLabel={isDeleting ? "Deleting…" : "Delete"}
          isDestructive
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}

      {isRenaming ? (
        <div className="flex flex-col gap-2 pr-6">
          <input
            aria-label="Cover letter title"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="rounded border border-border bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleRename} isLoading={isSaving}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setIsRenaming(false)} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Link
          href={`/cover-letter/${letter.id}`}
          className="flex flex-1 flex-col gap-1 pr-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[15px] font-semibold text-ink">{title}</span>
          {letter.company && <span className="text-[13.5px] text-ink-secondary">{letter.company}</span>}
          <span className="mt-auto flex items-center gap-2 pt-3 text-[12.5px] text-ink-muted">
            <span>Cover letter</span>
            <span aria-hidden="true">&middot;</span>
            <span>
              Edited {new Date(letter.updated_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney" })}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
