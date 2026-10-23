"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LockIcon, MicIcon } from "@/components/ui/icons/LucideIcons";

/** Records consent server-side; the screen goes on either way, since the choice was made here. */
export async function saveMicConsent(): Promise<void> {
  try {
    await fetch("/api/interview/mic-consent", { method: "POST" });
  } catch {
    // Offline: asked again next time, which is the safe side.
  }
}

/**
 * Shown once, before the browser's own microphone prompt. Choosing to type doesn't count as
 * agreeing, so it comes back the next time Out loud is picked.
 */
export function MicConsentCard({ onAllow, onType }: { onAllow: () => void | Promise<void>; onType: () => void }) {
  const [saving, setSaving] = useState(false);
  return (
    <div role="region" aria-labelledby="mic-consent-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-paper p-5 text-left">
      <h3 id="mic-consent-heading" className="flex items-center gap-2 text-base font-semibold text-ink">
        <MicIcon className="h-4 w-4 text-accent" /> Before we use your microphone
      </h3>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-secondary">
        <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
        Your answer is sent to Google to score it, then deleted. We never store your audio.
      </p>
      <p className="text-sm leading-relaxed text-ink-secondary">Your browser will ask for microphone access next.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          isLoading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onAllow();
            } finally {
              setSaving(false);
            }
          }}
        >
          Allow and continue
        </Button>
        <Button variant="ghost" onClick={onType} disabled={saving}>
          Type my answers instead
        </Button>
      </div>
    </div>
  );
}
