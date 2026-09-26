"use client";

import { useCallback, useRef, useState } from "react";
import { PreGenerateCheckModal } from "@/components/resume/PreGenerateCheckModal";
import { getSpellChecker } from "@/lib/text/spellcheck";
import { findTextIssues, type CheckInput, type SourceIssues } from "@/lib/text/preGenerateCheck";

/**
 * Warn-only spelling/grammar gate to run right before generating a resume. `confirm` resolves true
 * when the text is clean or the user chooses to continue, false when they go back (or a check is
 * already in progress). If the dictionary can't load, it resolves true: a broken checker must
 * never stop someone generating. Render `modal` once next to the caller.
 */
export function usePreGenerateCheck() {
  const [issues, setIssues] = useState<SourceIssues[] | null>(null);
  const settleRef = useRef<((proceed: boolean) => void) | null>(null);
  const isRunningRef = useRef(false);

  const confirm = useCallback(async (input: CheckInput): Promise<boolean> => {
    if (isRunningRef.current) return false;
    isRunningRef.current = true;

    let found: SourceIssues[] = [];
    try {
      found = findTextIssues(input.sources, await getSpellChecker(), input.knownWords);
    } catch {
      // Checker unavailable: skip the check rather than block generation.
    }

    if (found.length === 0) {
      isRunningRef.current = false;
      return true;
    }
    return new Promise<boolean>((resolve) => {
      settleRef.current = resolve;
      setIssues(found);
    });
  }, []);

  const settle = useCallback((proceed: boolean) => {
    setIssues(null);
    settleRef.current?.(proceed);
    settleRef.current = null;
    isRunningRef.current = false;
  }, []);

  const modal = (
    <PreGenerateCheckModal issues={issues} onContinue={() => settle(true)} onCancel={() => settle(false)} />
  );

  return { confirm, modal };
}
