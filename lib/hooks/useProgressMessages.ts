"use client";

import { useEffect, useState } from "react";

/**
 * Cycles through a list of status messages while `isActive` is true, so a long-running
 * generation call (10-20s+) reads as progress rather than a frozen spinner. Resets to the
 * first message whenever a new run starts.
 */
export function useProgressMessages(messages: string[], isActive: boolean, intervalMs = 3000): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setIndex((i) => Math.min(i + 1, messages.length - 1));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isActive, messages.length, intervalMs]);

  return messages[index];
}

export function useProgressStage(
  stages: string[],
  isActive: boolean,
  intervalMs = 3000
): { currentStage: string; stageIndex: number; progressPct: number } {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setIndex((i) => Math.min(i + 1, stages.length - 1));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isActive, stages.length, intervalMs]);

  const progressPct = isActive
    ? Math.min(92, Math.round(((index + 1) / (stages.length + 0.5)) * 100))
    : 0;

  return {
    currentStage: stages[index],
    stageIndex: index,
    progressPct,
  };
}
