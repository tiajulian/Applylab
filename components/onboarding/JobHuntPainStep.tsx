"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { clsx } from "@/lib/utils";
import type { JobHuntPain } from "@/types";

export interface JobHuntPainOption {
  id: JobHuntPain;
  icon: string;
  title: string;
  subtext: string;
}

export const JOB_HUNT_PAIN_OPTIONS: JobHuntPainOption[] = [
  {
    id: "writing_resumes",
    icon: "✍️",
    title: "Writing & polishing résumés",
    subtext: "Struggling to quantify achievements or pass ATS keyword screens",
  },
  {
    id: "not_hearing_back",
    icon: "📬",
    title: "Applying and not hearing back",
    subtext: "Sending out applications into a black hole without callbacks",
  },
  {
    id: "interviews",
    icon: "🎙️",
    title: "Interview nerves & prep",
    subtext: "Knowing how to structure STAR answers and speak with confidence",
  },
  {
    id: "knowing_what_to_apply_for",
    icon: "🎯",
    title: "Knowing what to apply for",
    subtext: "Unclear where your transferable skills fit in today's market",
  },
];

interface JobHuntPainStepProps {
  initialPain?: JobHuntPain | string | null;
  onSelectPain: (pain: JobHuntPain) => void;
  onBack?: () => void;
}

export function JobHuntPainStep({
  initialPain = null,
  onSelectPain,
  onBack,
}: JobHuntPainStepProps) {
  const [selectedPain, setSelectedPain] = useState<JobHuntPain | null>(
    (initialPain as JobHuntPain) || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleContinue() {
    if (selectedPain && !isSubmitting) {
      setIsSubmitting(true);
      onSelectPain(selectedPain);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-8 rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8"
    >
      {/* Category Tag & Header */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-accent-soft/40 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-accent border border-accent/20">
          YOUR CHALLENGE
        </span>
        <h2 className="mt-3 font-display text-h2 font-bold text-ink">
          What&apos;s the hardest part of job hunting for you?
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          We prioritize the right tools and guidance to help you overcome your biggest hurdle.
        </p>
      </div>

      {/* Pain Cards Grid with a11y radiogroup */}
      <div role="radiogroup" aria-label="Select your primary job hunt challenge">
        <StaggerList className="grid gap-4 sm:grid-cols-2">
          {JOB_HUNT_PAIN_OPTIONS.map((option) => {
            const isSelected = selectedPain === option.id;
            return (
              <StaggerItem key={option.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSelectedPain(option.id);
                  }}
                  className={clsx(
                    "group relative flex min-h-[88px] h-full w-full flex-col justify-between rounded-xl border p-5 text-left transition-all duration-fast ease-editorial hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "border-accent bg-accent-soft/30 ring-2 ring-accent/30 shadow-sm"
                      : "border-border bg-paper hover:border-accent/50 hover:bg-paper-deep"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" role="img" aria-label={option.title}>
                        {option.icon}
                      </span>
                      <span className="font-display text-base font-bold text-ink group-hover:text-accent transition-colors">
                        {option.title}
                      </span>
                    </div>
                    {isSelected && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent shadow-xs"
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-ink-secondary leading-relaxed">
                    {option.subtext}
                  </p>
                </button>
              </StaggerItem>
            );
          })}
        </StaggerList>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t border-border pt-5">
        {onBack ? (
          <button
            type="button"
            className="rounded text-sm text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onBack}
          >
            ← Back
          </button>
        ) : (
          <span className="text-xs text-ink-muted">Single-tap selection</span>
        )}
        <Button
          type="button"
          size="md"
          disabled={!selectedPain || isSubmitting}
          onClick={handleContinue}
        >
          {isSubmitting ? "Saving..." : "Continue →"}
        </Button>
      </div>
    </motion.div>
  );
}
