"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Resume } from "@/types";

export function ResumeCard({ resume }: { resume: Resume }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setIsMenuOpen(false);
    const label = resume.job_title || "this resume";
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;

    setIsDeleting(true);
    setError(null);

    const response = await fetch(`/api/resume/${resume.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setIsDeleting(false);
      setError(data.error ?? "Failed to delete resume");
      return;
    }

    setIsDeleted(true);
  }

  if (isDeleted) return null;

  return (
    <div className="relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div ref={menuRef} className="absolute right-3 top-3">
        <button
          type="button"
          aria-label="Resume options"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      <Link href={`/resume/${resume.id}`} className="flex flex-col gap-2 pr-6">
        <span className="text-sm font-medium text-gray-900">
          {resume.job_title || "Untitled role"}
        </span>
        <span className="text-sm text-gray-500">{resume.company_name || "No company name"}</span>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>{new Date(resume.created_at).toLocaleDateString("en-AU")}</span>
          <div className="flex gap-1.5">
            {resume.ats_score !== null && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                ATS {resume.ats_score}
              </span>
            )}
            {resume.content_score !== null && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                Content {resume.content_score}
              </span>
            )}
          </div>
        </div>
      </Link>
      <Link
        href={`/resume/${resume.id}/duplicate`}
        className="self-start text-xs font-medium text-brand-600 hover:underline"
      >
        Duplicate &amp; tailor
      </Link>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
