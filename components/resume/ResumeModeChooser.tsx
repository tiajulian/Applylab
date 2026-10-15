"use client";

import type { ReactNode } from "react";
import { FileTextIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";

export type ResumeMode = "tailored" | "general";

const OPTIONS: Array<{ mode: ResumeMode; title: string; description: string; icon: ReactNode }> = [
  {
    mode: "tailored",
    title: "Tailor to a job ad",
    description: "Best when you're applying for a specific job.",
    icon: <FileTextIcon className="h-5 w-5" />,
  },
  {
    mode: "general",
    title: "Build a general resume",
    description: "No job ad yet? Make one you can tailor later.",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
];

/**
 * The two ways to start a resume, always visible above the form. It used to be a popup that
 * covered the page on arrival - an interruption before the user had even seen what the page was
 * for. Switching keeps the other form's state, because ResumeGate holds both.
 */
export function ResumeModeChooser({
  currentMode,
  onSelect,
}: {
  currentMode: ResumeMode;
  onSelect: (mode: ResumeMode) => void;
}) {
  return (
    <div role="group" aria-label="What kind of resume?" className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map(({ mode, title, description, icon }) => {
        const selected = mode === currentMode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            aria-pressed={selected}
            className={`flex items-start gap-3.5 rounded-lg border-2 p-4 text-left transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 ${
              selected ? "border-accent bg-accent-soft/60" : "border-border bg-surface hover:border-border-strong"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                selected ? "bg-accent-hover text-on-accent" : "bg-paper-deep text-ink-secondary"
              }`}
            >
              {icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15.5px] font-semibold text-ink">{title}</span>
              <span className="text-[13.5px] leading-snug text-ink-secondary">{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
