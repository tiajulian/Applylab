"use client";

import { useState } from "react";
import { Reveal } from "@/components/ui/Reveal";

export function FirstRunBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Reveal>
      <div className="flex items-center justify-between gap-4 rounded border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent">
        <span>Let&apos;s build your first resume. Paste a job ad below to start.</span>
        <button
          type="button"
          className="shrink-0 text-accent/70 hover:underline"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </Reveal>
  );
}
