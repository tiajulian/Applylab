"use client";

import { ProgressLoader } from "@/components/ui/ProgressLoader";

const STEPS = [
  "Reading the job ad",
  "Picking your strongest matching experience",
  "Writing your opening and evidence",
  "Polishing tone and length",
];

// Advice only - no statistics, so nothing here can be wrong or out of date.
const TIPS = [
  "Tip: Read the letter aloud once before sending. Clunky sentences stand out fast.",
  "Tip: If the ad names a contact, address the letter to them by first name.",
  "Tip: Every claim in the letter should be something you can talk about in an interview.",
  "Tip: Swap in one detail about the company only you would know. It makes the letter yours.",
];

/** Cover letter generation takes ~10-20s, so the bar is paced to match rather than the 7s default. */
export function CoverLetterProgress({ isLoading, className }: { isLoading: boolean; className?: string }) {
  return (
    <ProgressLoader
      title="Writing your cover letter..."
      steps={STEPS}
      tips={TIPS}
      isLoading={isLoading}
      durationMs={15_000}
      className={className}
    />
  );
}
