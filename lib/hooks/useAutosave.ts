"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

// Also reused by lib/hooks/useResumeHistory.ts as the idle-checkpoint fallback delay, so a long
// uninterrupted edit gets an undo checkpoint on the same cadence autosave persists it.
export const AUTOSAVE_DELAY_MS = 800;

export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = AUTOSAVE_DELAY_MS
): { status: AutosaveStatus; error: string | null; saveNow: () => Promise<void> } {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const isFirstRun = useRef(true);
  const latestCallId = useRef(0);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always the latest render's value/onSave - a timer scheduled several renders ago (or an
  // imperative saveNow() call) must not save a stale snapshot or call a stale onSave closure.
  const latestValue = useRef(value);
  latestValue.current = value;
  const latestOnSave = useRef(onSave);
  latestOnSave.current = onSave;

  // Stable identity (everything it needs is behind refs, not closed-over render values) so a
  // consumer wiring saveNow into e.g. a keyboard-shortcut effect's dependency array doesn't tear
  // down and re-subscribe that effect on every render.
  const runSave = useCallback(async () => {
    const callId = ++latestCallId.current;
    setStatus("saving");
    setError(null);

    try {
      await latestOnSave.current(latestValue.current);
      if (callId === latestCallId.current) {
        setStatus("saved");
      }
    } catch (err) {
      if (callId === latestCallId.current) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    }
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const timer = setTimeout(runSave, delayMs);
    pendingTimer.current = timer;
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Bypasses the debounce - e.g. a Ctrl/Cmd+S shortcut wanting an immediate, visible save rather
  // than waiting out the usual idle delay. Cancels any timer already in flight so a save doesn't
  // also fire redundantly a moment later.
  const saveNow = useCallback(async () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    await runSave();
  }, [runSave]);

  return { status, error, saveNow };
}
