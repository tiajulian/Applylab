"use client";

import { useMemo, useState } from "react";
import { ResumeEditorForm } from "@/components/resume/ResumeEditorForm";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { useAutosave } from "@/lib/hooks/useAutosave";
import type { ResumeContent } from "@/types";

function getWarnings(resume: ResumeContent): string[] {
  const warnings: string[] = [];
  if (!resume.contact.name.trim()) warnings.push("Full name is empty.");
  if (resume.experience.length === 0) warnings.push("No work experience listed.");
  if (resume.skills.length === 0) warnings.push("No skills listed.");
  return warnings;
}

export function ResumeEditor({
  resumeId,
  initialResumeContent,
}: {
  resumeId: string;
  initialResumeContent: ResumeContent;
}) {
  const [resume, setResume] = useState(initialResumeContent);

  const { status, error } = useAutosave(resume, async (value) => {
    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_content: value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to save resume");
    }
  });

  const warnings = useMemo(() => getWarnings(resume), [resume]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <span
              key={warning}
              className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800"
            >
              {warning}
            </span>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && <span className="text-red-600">{error ?? "Failed to save"}</span>}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ResumeEditorForm resumeId={resumeId} resume={resume} onChange={setResume} />
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ResumePreview resume={resume} />
        </div>
      </div>
    </div>
  );
}
