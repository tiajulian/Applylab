"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { NAV_COPY } from "@/lib/copy";

const MATCHER_DISMISS_KEY = "applylab:matcher-completeness-dismissed";

export function ProfileCompleteness({
  completeness,
  suggestionText,
  context,
  firstRun = false,
}: {
  completeness: number;
  suggestionText: string;
  context: "dashboard" | "matcher";
  firstRun?: boolean;
}) {
  const [dismissed, setDismissed] = useState(context === "matcher");
  const [hydrated, setHydrated] = useState(context !== "matcher");

  // Dismissal on the matcher persists only for the browser session (sessionStorage), so it's
  // read after mount, not blocking-checked before it, so this never delays or gates the primary
  // "See how I match this job" action above it.
  useEffect(() => {
    if (context !== "matcher") return;
    setDismissed(sessionStorage.getItem(MATCHER_DISMISS_KEY) === "1");
    setHydrated(true);
  }, [context]);

  if (context === "matcher" && firstRun) return null;
  if (completeness >= 100) return null;
  if (!hydrated || dismissed) return null;

  const rewardText = suggestionText
    ? `Add ${suggestionText} to unlock higher match scores.`
    : "Finish a few more details to unlock higher match scores.";

  const dismissMatcher = () => {
    setDismissed(true);
    sessionStorage.setItem(MATCHER_DISMISS_KEY, "1");
  };

  if (context === "matcher") {
    return (
      <Reveal>
        <div className="flex items-center justify-between gap-4 rounded border border-border bg-paper-deep px-4 py-2.5 text-xs text-ink-secondary">
          <span>
            {NAV_COPY.careerProfile} is <CountUp value={completeness} suffix="%" /> built. {rewardText}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/profile" className="font-medium text-accent hover:underline">
              Finish profile &rarr;
            </Link>
            <button
              type="button"
              className="text-ink-muted hover:underline"
              onClick={dismissMatcher}
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        </div>
      </Reveal>
    );
  }

  return (
    <Reveal>
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-ink">{NAV_COPY.careerProfile} completeness</span>
          <span className="text-ink-secondary">
            <CountUp value={completeness} suffix="%" />
          </span>
        </div>
        <ProgressBar value={completeness} className="mt-2" />
        <p className="mt-2 text-xs text-ink-secondary">
          You&apos;ve built {completeness}% of a stronger profile. {rewardText}{" "}
          <Link href="/profile" className="font-medium text-accent hover:underline">
            Finish profile &rarr;
          </Link>
        </p>
      </Card>
    </Reveal>
  );
}
