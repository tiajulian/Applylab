"use client";

import { useState } from "react";
import { FileTextIcon, UploadIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { MAX_FILE_BYTES, RESUME_FILE_ACCEPT } from "@/lib/resume/uploadLimits";

const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);

/** Client-side check, so a wrong file is caught instantly rather than after an upload. The server
 * still sniffs the real file type (lib/resume/extractText.ts). */
function fileProblem(file: File): string | null {
  if (!/\.(pdf|docx)$/i.test(file.name)) return "That file type isn't supported. Upload a PDF or Word document (.docx).";
  if (file.size > MAX_FILE_BYTES) return `That file is over ${MAX_MB} MB. Try a smaller PDF or Word document.`;
  return null;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Drop zone for one resume file, which turns into a file chip once a file is chosen. */
export function ResumeFileDrop({
  file,
  onFileChange,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function choose(next: File | undefined) {
    if (!next) return;
    const issue = fileProblem(next);
    setProblem(issue);
    if (!issue) onFileChange(next);
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-paper-deep/50 p-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-accent-hover shadow-sm"
        >
          <FileTextIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{file.name}</p>
          <p className="text-[12px] text-ink-muted">{formatSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onFileChange(null)}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-editorial hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(event) => {
          // Moving onto a child also fires dragleave; only leaving the zone itself counts.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) choose(event.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors duration-fast ease-editorial has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
          isDragging ? "border-accent bg-accent-soft/40" : "border-border-strong hover:border-accent hover:bg-accent-soft/20"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
        >
          <UploadIcon className="h-5 w-5" />
        </span>
        <span className="text-[14px] font-semibold text-ink">
          {isDragging ? "Drop it here" : (
            <>
              Drop your resume here, or <span className="text-accent-hover underline underline-offset-4">browse</span>
            </>
          )}
        </span>
        <span className="text-[12.5px] text-ink-muted">PDF or Word (.docx), up to {MAX_MB} MB</span>
        <input
          type="file"
          accept={RESUME_FILE_ACCEPT}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            // Cleared so choosing the same file again (after removing it) still fires onChange.
            event.target.value = "";
          }}
        />
      </label>
      {problem && <p className="text-[13px] text-critical">{problem}</p>}
    </div>
  );
}
