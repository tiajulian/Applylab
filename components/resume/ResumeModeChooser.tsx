"use client";

import type { ReactNode } from "react";
import { FileTextIcon, SparklesIcon } from "@/components/ui/icons/LucideIcons";

export type ResumeMode = "tailored" | "general";

const OPTIONS: Array<{ mode: ResumeMode; title: string; description: string; icon: ReactNode }> = [
  {
    mode: "tailored",
    title: "Tailor to a job ad",
    description: "Paste the job ad and we'll match your experience to it. Best when you're applying for a specific role.",
    icon: <FileTextIcon className="h-5 w-5" />,
  },
  {
    mode: "general",
    title: "Build a general resume",
    description: "No job ad yet? We'll build a solid resume from your profile that you can tailor to a job later.",
    icon: <SparklesIcon className="h-5 w-5" />,
  },
];

export function ResumeModeChooser({ onSelect }: { onSelect: (mode: ResumeMode) => void }) {
  return (
    <div className="flex flex-col gap-4 rounded border border-border bg-surface p-6">
      <h2 className="font-display text-h3 text-ink">How do you want to start?</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ mode, title, description, icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="flex flex-col items-start gap-2 rounded border border-border bg-paper/60 p-5 text-left transition-colors duration-fast ease-editorial hover:border-accent hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-accent">{icon}</span>
            <span className="text-base font-semibold text-ink">{title}</span>
            <span className="text-sm text-ink-secondary">{description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
