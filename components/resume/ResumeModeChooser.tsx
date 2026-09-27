"use client";

import { useEffect, type ReactNode } from "react";
import { FileTextIcon, SparklesIcon, XIcon } from "@/components/ui/icons/LucideIcons";

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

/**
 * "How do you want to start?" popup. Picking an option calls `onSelect`; dismissing it (X, Escape or a
 * click outside) calls `onClose` and leaves whatever form is behind it as it was.
 */
export function ResumeModeChooser({
  isOpen,
  currentMode,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  /** The mode already in use, highlighted so reopening the popup shows where the user is. */
  currentMode: ResumeMode;
  onSelect: (mode: ResumeMode) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-mode-chooser-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-xs" onClick={onClose} />

      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-auto sm:w-auto sm:p-1"
          aria-label="Close"
        >
          <XIcon className="h-5 w-5" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <h2 id="resume-mode-chooser-title" className="pr-8 font-display text-h3 font-bold text-ink">
            How do you want to start?
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {OPTIONS.map(({ mode, title, description, icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => onSelect(mode)}
                aria-current={mode === currentMode ? "true" : undefined}
                className={`flex flex-col items-start gap-2 rounded border p-5 text-left transition-colors duration-fast ease-editorial hover:border-accent hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  mode === currentMode ? "border-accent bg-accent-soft/40" : "border-border bg-paper/60"
                }`}
              >
                <span className="text-accent">{icon}</span>
                <span className="text-base font-semibold text-ink">{title}</span>
                <span className="text-sm text-ink-secondary">{description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
