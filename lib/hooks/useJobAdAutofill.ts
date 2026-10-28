"use client";

import { useEffect, useRef } from "react";
import { useAccountGate } from "@/components/auth/AccountGate";

const JOB_AD_PARSE_DEBOUNCE_MS = 600;
const MIN_JOB_AD_LENGTH_TO_PARSE = 20;

type FilledFields = { title?: string; company?: string };

/**
 * Shared by ResumeForm.tsx and DuplicateResumeForm.tsx: pasting or leaving the job-ad textarea
 * debounces a call to /api/parse-job-ad and fills title/company from the result, unless the user
 * has already hand-edited that field (touched refs, not state, since nothing in the UI reflects
 * "touched" status and a re-render would defeat the point of reading them at debounce-fire time).
 * Guests skip it (reading the ad uses AI, which needs a free account); `fillFromAd` lets the form
 * run it once they've signed up - a no-op if this ad was already read.
 */
export function useJobAdAutofill({
  setJobTitle,
  setCompanyName,
  prefilled,
}: {
  setJobTitle: (title: string) => void;
  setCompanyName: (company: string) => void;
  /** Fields already filled from a known source (a Find jobs listing): the ad mustn't replace them. */
  prefilled?: { title: boolean; company: boolean };
}) {
  const titleTouchedRef = useRef(prefilled?.title ?? false);
  const companyTouchedRef = useRef(prefilled?.company ?? false);
  const lastParsedAdRef = useRef("");
  // The read currently running, so a second ask for the same ad waits on it instead of getting null.
  const inFlightRef = useRef<{ text: string; promise: Promise<FilledFields | null> } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isGuest } = useAccountGate();

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  /**
   * Fills title/company from the ad; resolves with whichever of the two it actually set. If the
   * paste/blur autofill is still reading this same ad, resolves with that read's result: returning
   * null there let a quick click on "See how I match" send the fit check with no job title.
   */
  function runJobAdParse(adText: string): Promise<FilledFields | null> {
    const trimmed = adText.trim();
    if (inFlightRef.current?.text === trimmed) return inFlightRef.current.promise;

    const promise = parseAd(trimmed).finally(() => {
      if (inFlightRef.current?.promise === promise) inFlightRef.current = null;
    });
    inFlightRef.current = { text: trimmed, promise };
    return promise;
  }

  async function parseAd(trimmed: string): Promise<FilledFields | null> {
    if (trimmed.length < MIN_JOB_AD_LENGTH_TO_PARSE || trimmed === lastParsedAdRef.current) return null;
    lastParsedAdRef.current = trimmed;

    const response = await fetch("/api/parse-job-ad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adText: trimmed }),
    }).catch(() => null);

    // Graceful failure by design: a network error, timeout, or rate-limit here just means the fields
    // stay as they are — never a blocking or scary error, since this is a non-metered autofill
    // helper, not part of generation itself. Reset the ref on failure so an unedited retry (the
    // next paste/blur with the same text) isn't silently swallowed by the de-dupe check above.
    if (!response?.ok) {
      lastParsedAdRef.current = "";
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data) {
      lastParsedAdRef.current = "";
      return null;
    }

    const filled: FilledFields = {};
    if (!titleTouchedRef.current && typeof data.title === "string" && data.title) {
      setJobTitle(data.title);
      filled.title = data.title;
    }
    if (!companyTouchedRef.current && typeof data.company === "string" && data.company) {
      setCompanyName(data.company);
      filled.company = data.company;
    }
    return filled;
  }

  function scheduleJobAdParse(adText: string) {
    if (isGuest) return;
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

  return {
    titleTouchedRef,
    companyTouchedRef,
    handleJobDescriptionPaste,
    handleJobDescriptionBlur,
    fillFromAd: runJobAdParse,
  };
}
