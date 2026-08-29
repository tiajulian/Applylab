"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

const DIAGNOSTIC_STEPS = [
  "Parsing contact header and ATS section structure…",
  "Evaluating bullet impact and ownership metrics…",
  "Checking active verbs, passive voice, and concise tone…",
  "Scanning job keywords and industry alignment…",
  "Verifying application readiness and page budget…",
  "Compiling recruiter diagnostic panel…",
];

export function ReviewScoringLoader() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1 < DIAGNOSTIC_STEPS.length ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="flex flex-col items-center justify-center gap-6 border border-border bg-surface p-12 text-center shadow-sm">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute h-full w-full animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
        <span className="text-xl">📊</span>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <h3 className="font-display text-h3 font-semibold text-ink">
          Running AI Resume Review
        </h3>
        <p className="text-sm text-ink-secondary min-h-[1.5rem] transition-opacity duration-fast">
          {DIAGNOSTIC_STEPS[currentStepIndex]}
        </p>
      </div>

      <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-paper-deep">
        <div className="indeterminate-bar" />
      </div>

      <p className="text-xs text-ink-muted">
        Evaluating your resume across all 5 scoring pillars (~5-10s)
      </p>
    </Card>
  );
}
