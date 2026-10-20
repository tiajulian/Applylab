"use client";

import type { ReactNode } from "react";
import { FileTextIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";

export type ResumeMode = "tailored" | "general";

const OPTIONS: Array<{ mode: ResumeMode; label: string; icon: ReactNode }> = [
  { mode: "tailored", label: "For a job ad", icon: <FileTextIcon className="h-4 w-4" /> },
  { mode: "general", label: "General resume", icon: <SparklesIcon className="h-4 w-4" /> },
];

/**
 * The two ways to start a resume, as a compact switch above the form. Each form explains itself,
 * so the switch only needs the labels. Switching keeps the other form's state, because ResumeGate
 * holds both.
 */
export function ResumeModeChooser({
  currentMode,
  onSelect,
}: {
  currentMode: ResumeMode;
  onSelect: (mode: ResumeMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="What kind of resume?"
      className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-paper-deep/60 p-1 sm:inline-grid sm:w-auto sm:self-start"
    >
      {OPTIONS.map(({ mode, label, icon }) => {
        const selected = mode === currentMode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            aria-pressed={selected}
            className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[14px] font-semibold transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              selected ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
            }`}
          >
            <span aria-hidden="true" className={selected ? "text-accent-hover" : undefined}>
              {icon}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
