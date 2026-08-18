"use client";

import { useState } from "react";

/**
 * Shared shape for a card's own PATCH-and-report action: pending while in flight, a visible error
 * only when the request truly failed (the passed-in `action` returns null), never a false
 * success. Consolidates what was previously five near-identical isSaving/error/patchItem copies
 * across DutyCard, DutyImpact-adjacent cards, and SkillsBridgeReview's Matched/ToConfirm/Gap
 * cards - see components/profile/RoleDutiesReview.tsx and components/resume/SkillsBridgeReview.tsx.
 */
export function useSaveAction<T>(failureMessage = "Couldn't save. Please try again.") {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<T | null>): Promise<T | null> {
    setIsSaving(true);
    setError(null);
    try {
      // A thrown network error (fetch itself failing, not just a non-2xx response) is treated
      // the same as a null result - either way the save didn't happen, and isSaving must still
      // clear via the finally below rather than leaving the caller's button spinning forever.
      const result = await action();
      if (result === null) {
        setError(failureMessage);
        return null;
      }
      return result;
    } catch {
      setError(failureMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return { isSaving, error, run, clearError };
}
