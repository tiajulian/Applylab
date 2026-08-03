"use client";

import { useState } from "react";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { Reveal } from "@/components/ui/Reveal";
import { buildCoverLetterHeader } from "@/lib/text/coverLetterHeader";
import type { ResumeContact } from "@/types";

export function CoverLetterPreview({
  resumeId,
  initialCoverLetter,
  contact,
}: {
  resumeId: string;
  initialCoverLetter: string;
  contact: ResumeContact;
}) {
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter);
  // Computed once per mount rather than re-run on every render - the letter's date shouldn't
  // silently roll over to tomorrow under the user's cursor while they're mid-edit.
  const [header] = useState(() => buildCoverLetterHeader(contact));

  const { status, error } = useAutosave(coverLetter, async (value) => {
    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_letter_content: value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to save cover letter");
    }
  });

  return (
    <Reveal>
      <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-2">
        <div className="flex items-center justify-end">
          <span className="text-xs text-ink-muted">
            {status === "saving" && "Saving…"}
            {status === "saved" && "Saved"}
            {status === "error" && <span className="text-critical">{error ?? "Failed to save"}</span>}
          </span>
        </div>
        <div className="rounded border border-border bg-surface px-10 py-8 shadow-sm">
          {/* Rendered from the profile and today's date - never from the model, and not editable
              here (contact details are edited on the Profile page). */}
          <p className="text-base font-semibold text-ink">{header.name}</p>
          {header.contactLine && <p className="mt-1 text-xs text-ink-muted">{header.contactLine}</p>}
          <p className="mt-1 text-xs text-ink-muted">{header.date}</p>
        </div>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={20}
          className="w-full rounded border border-border bg-surface p-10 text-sm leading-relaxed text-ink shadow-sm transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </Reveal>
  );
}
