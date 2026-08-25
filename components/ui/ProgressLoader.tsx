"use client";

import { useEffect, useState } from "react";
import { clsx } from "@/lib/utils";

export interface ProgressLoaderProps {
  /** Main loading title header. Default: "Analyzing & Tailoring..." */
  title?: string;
  /** Sequential steps array to display. Default: 4-step resume tailoring sequence. */
  steps?: string[];
  /** Loading boolean trigger from host page/component. */
  isLoading: boolean;
  /** Rotating tips shown at bottom to keep user engaged. */
  tips?: string[];
  /** Optional container style overrides. */
  className?: string;
}

const DEFAULT_STEPS = [
  "Scanning SEEK job criteria & keywords",
  "Cross-referencing Master Profile evidence",
  "Auditing skill matches & gap analysis",
  "Formatting strict Australian A4 layout",
];

const DEFAULT_TIPS = [
  "Pro Tip: Customizing your resume for each SEEK ad increases response rates by 3x.",
  "Did you know? Australian recruiters spend under 7 seconds on initial resume scans.",
  "Fact: ATS algorithms favor clean single-column A4 layouts with standard section headings.",
  "Applying to leadership roles? Quantified metric achievements grab immediate attention.",
];

export function ProgressLoader({
  title = "Analyzing & Tailoring...",
  steps = DEFAULT_STEPS,
  isLoading,
  tips = DEFAULT_TIPS,
  className,
}: ProgressLoaderProps) {
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Pacing timer logic purely driven by isLoading prop
  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      setCurrentStepIndex(steps.length);
      return;
    }

    // Reset state on start
    setProgress(5);
    setCurrentStepIndex(0);

    const totalSteps = steps.length;
    if (totalSteps === 0) return;

    // Step progression interval: advance progress towards ~90% over 6-8 seconds
    const intervalTime = 150; // ms
    const increment = 85 / (7000 / intervalTime);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressTimer);
          return 90;
        }
        const next = Math.min(prev + increment, 90);
        const calculatedStep = Math.max(
          0,
          Math.min(Math.floor((next / 90) * totalSteps), totalSteps - 1)
        );
        setCurrentStepIndex(calculatedStep);
        return next;
      });
    }, intervalTime);

    return () => clearInterval(progressTimer);
  }, [isLoading, steps.length]);

  // Rotate tips every 3.2 seconds
  useEffect(() => {
    if (!tips || tips.length === 0) return;
    const tipTimer = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 3200);

    return () => clearInterval(tipTimer);
  }, [tips]);

  const activeTip = tips && tips.length > 0 ? tips[currentTipIndex % tips.length] : null;

  return (
    <div
      className={clsx(
        "rounded-2xl border border-border bg-surface p-6 shadow-sm max-w-md w-full mx-auto text-ink transition-all duration-300",
        className
      )}
    >
      {/* Title & Percentage Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-h3 font-bold text-ink truncate">{title}</h3>
        <span className="font-mono text-xs font-bold text-accent shrink-0">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Animated Progress Bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-deep">
        <div
          className="h-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps List */}
      {steps.length > 0 && (
        <div className="mt-6 space-y-3">
          {steps.map((stepText, index) => {
            const isCompleted = index < currentStepIndex || progress === 100;
            const isActive = index === currentStepIndex && progress < 100;

            return (
              <div key={`${stepText}-${index}`} className="flex items-center gap-3 text-sm">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {isCompleted ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-xs font-bold text-success">
                      ✓
                    </span>
                  ) : isActive ? (
                    <span className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                    </span>
                  ) : (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-ink-muted">
                      ○
                    </span>
                  )}
                </div>

                <span
                  className={clsx(
                    "transition-colors duration-200",
                    isCompleted && "text-ink font-medium",
                    isActive && "text-accent font-semibold",
                    !isCompleted && !isActive && "text-ink-muted"
                  )}
                >
                  {stepText}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Rotating Tip Footer */}
      {activeTip && (
        <div className="mt-6 border-t border-border pt-4 text-xs text-ink-secondary flex items-start gap-2 bg-accent-soft/40 -mx-6 -mb-6 p-4 rounded-b-2xl">
          <span className="text-accent shrink-0 font-bold">💡</span>
          <p className="line-clamp-2 transition-opacity duration-300 font-medium text-ink-secondary">
            {activeTip}
          </p>
        </div>
      )}
    </div>
  );
}
