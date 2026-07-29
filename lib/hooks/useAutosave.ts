"use client";

import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = 800
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
