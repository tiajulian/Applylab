"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";
import { trackFunnelEvent } from "@/lib/analytics";
import { clsx } from "@/lib/utils";
import type { StoryHint } from "@/types";

/**
 * "Stories from your profile that could fit": the candidate's own logged roles, wins and projects
 * the question writer picked for this question. Suggests which real story to tell; never writes one.
 * Renders nothing when there are none (no empty state).
 */
export function StoryHints({ hints, defaultOpen }: { hints: StoryHint[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [shown, setShown] = useState<string | null>(null);
  if (hints.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-paper">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) trackFunnelEvent("interview_story_hint_opened");
          setOpen((v) => !v);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Stories from your profile that could fit ({hints.length})
        <ChevronDownIcon className={clsx("h-4 w-4 text-ink-secondary transition-transform duration-fast", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          <ul className="flex flex-wrap gap-2">
            {hints.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  aria-pressed={shown === h.id}
                  onClick={() => setShown((cur) => (cur === h.id ? null : h.id))}
                  className={clsx(
                    "rounded-pill border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    shown === h.id ? "border-accent bg-accent-soft text-ink" : "border-border bg-surface text-ink-secondary hover:text-ink"
                  )}
                >
                  {h.label}
                </button>
              </li>
            ))}
          </ul>
          {shown && (
            <p className="text-xs leading-relaxed text-ink-secondary">{hints.find((h) => h.id === shown)?.detail || "From your profile."}</p>
          )}
        </div>
      )}
    </div>
  );
}
