"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

// Also reused by lib/hooks/useResumeHistory.ts as the idle-checkpoint fallback delay, so a long
// uninterrupted edit gets an undo checkpoint on the same cadence autosave persists it.
export const AUTOSAVE_DELAY_MS = 800;

export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = AUTOSAVE_DELAY_MS
): { status: AutosaveStatus; error: string | null } {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const isFirstRun = useRef(true);
  const latestCallId = useRef(0);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const callId = ++latestCallId.current;
    const timer = setTimeout(async () => {
      setStatus("saving");
      setError(null);

      try {
        await onSave(value);
        if (callId === latestCallId.current) {
          setStatus("saved");
        }
      } catch (err) {
        if (callId === latestCallId.current) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to save");
        }
      }
    }, delayMs);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return { status, error };
}
