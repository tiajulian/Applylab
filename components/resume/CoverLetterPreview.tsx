"use client";

import { useState } from "react";
import { useAutosave } from "@/lib/hooks/useAutosave";

export function CoverLetterPreview({
  resumeId,
  initialCoverLetter,
}: {
  resumeId: string;
  initialCoverLetter: string;
}) {
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter);

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
    <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-2">
      <div className="flex items-center justify-end">
        <span className="text-xs text-gray-400">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && <span className="text-red-600">{error ?? "Failed to save"}</span>}
        </span>
      </div>
      <textarea
        value={coverLetter}
        onChange={(e) => setCoverLetter(e.target.value)}
        rows={20}
        className="w-full rounded-lg border border-gray-200 bg-white p-10 text-sm leading-relaxed text-gray-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
