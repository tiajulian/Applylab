"use client";

import { useEffect, useRef } from "react";

const JOB_AD_PARSE_DEBOUNCE_MS = 600;
const MIN_JOB_AD_LENGTH_TO_PARSE = 20;

/**
 * Shared by ResumeForm.tsx and DuplicateResumeForm.tsx: pasting or leaving the job-ad textarea
 * debounces a call to /api/parse-job-ad and fills title/company from the result, unless the user
 * has already hand-edited that field (touched refs, not state, since nothing in the UI reflects
 * "touched" status and a re-render would defeat the point of reading them at debounce-fire time).
 */
export function useJobAdAutofill({
  setJobTitle,
  setCompanyName,
}: {
  setJobTitle: (title: string) => void;
  setCompanyName: (company: string) => void;
}) {
  const titleTouchedRef = useRef(false);
  const companyTouchedRef = useRef(false);
  const lastParsedAdRef = useRef("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  async function runJobAdParse(adText: string) {
    const trimmed = adText.trim();
    if (trimmed.length < MIN_JOB_AD_LENGTH_TO_PARSE || trimmed === lastParsedAdRef.current) return;
    lastParsedAdRef.current = trimmed;

    const response = await fetch("/api/parse-job-ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adText: trimmed }),
    });

    // Graceful failure by design: a timeout, error, or rate-limit here just means the fields
    // stay as they are — never a blocking or scary error, since this is a non-metered autofill
    // helper, not part of generation itself. Reset the ref on failure so an unedited retry (the
    // next paste/blur with the same text) isn't silently swallowed by the de-dupe check above.
    if (!response.ok) {
      lastParsedAdRef.current = "";
      return;
    }

    const data = await response.json().catch(() => null);
    if (!data) {
      lastParsedAdRef.current = "";
      return;
    }

    if (!titleTouchedRef.current && typeof data.title === "string" && data.title) {
      setJobTitle(data.title);
    }
    if (!companyTouchedRef.current && typeof data.company === "string" && data.company) {
      setCompanyName(data.company);
    }
  }

  function scheduleJobAdParse(adText: string) {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void runJobAdParse(adText);
    }, JOB_AD_PARSE_DEBOUNCE_MS);
  }

  function handleJobDescriptionPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    // The paste event fires before the browser applies the pasted text to .value, so reading
    // it synchronously here would see the pre-paste content — defer to the next tick.
    const target = event.target as HTMLTextAreaElement;
    setTimeout(() => scheduleJobAdParse(target.value), 0);
  }

  function handleJobDescriptionBlur(event: React.FocusEvent<HTMLTextAreaElement>) {
    scheduleJobAdParse(event.target.value);
  }

  return { titleTouchedRef, companyTouchedRef, handleJobDescriptionPaste, handleJobDescriptionBlur };
}
