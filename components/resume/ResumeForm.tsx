"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useProgressMessages } from "@/lib/hooks/useProgressMessages";

const GENERATION_MESSAGES = [
  "Reading the job description…",
  "Matching your experience to the role…",
  "Writing your resume…",
  "Almost done…",
];

const JOB_AD_PARSE_DEBOUNCE_MS = 600;
const MIN_JOB_AD_LENGTH_TO_PARSE = 20;

export function ResumeForm({
  disabled = false,
  isPaidPlan,
  remaining,
  limit,
}: {
  disabled?: boolean;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
}) {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  // Two separate error states: `adError` is specifically about the job-ad field (tied to the
  // textarea's red-border affordance), `error` is a generic form-level failure (a 500, a
  // timeout, etc.) that has nothing to do with what's in the ad text — conflating the two would
  // visually blame the textarea for problems that aren't about its content.
  const [adError, setAdError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState<{ limit: number } | null>(null);
  const progressMessage = useProgressMessages(GENERATION_MESSAGES, isGenerating);

  // Refs, not state: read at debounce-fire time so a field the user has since edited by hand
  // never gets silently overwritten by a slow-arriving auto-fill response, without needing this
  // to trigger re-renders (nothing in the UI reflects "touched" status).
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
    // helper, not part of generation itself.
    if (!response.ok) return;

    const data = await response.json().catch(() => null);
    if (!data) return;

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAdError(null);
    setLimitReached(null);

    if (!jobDescription.trim()) {
      setAdError("Paste the job ad to continue");
      return;
    }

    setIsGenerating(true);

    // Wrapped in try/catch/finally: a network failure, or a non-JSON response (e.g. a platform
    // timeout page, which isn't JSON), used to throw out of an unguarded response.json() call
    // here and leave isGenerating stuck true forever — the button would spin indefinitely with
    // no error ever shown. The generation itself can legitimately take a while (see
    // generate-resume/route.ts), so a slow response is expected; what must never happen is the
    // UI failing to resolve when it eventually does complete, error, or the connection drops.
    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, companyName, jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
          setLimitReached({ limit: data.limit });
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/resume/${data.resume.id}`);
    } catch {
      setError("Something went wrong — the request may have timed out. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor="jobDescription" className="text-sm font-medium text-gray-700">
            Job ad
          </label>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600">
            Required
          </span>
        </div>
        <Textarea
          id="jobDescription"
          placeholder="Paste the full job ad from SEEK here. We'll read the role and company automatically."
          className="min-h-[150px]"
          rows={10}
          value={jobDescription}
          onChange={(e) => {
            setJobDescription(e.target.value);
            if (adError) setAdError(null);
          }}
          onPaste={handleJobDescriptionPaste}
          onBlur={handleJobDescriptionBlur}
          error={adError ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-400">Pulled from the ad — edit if we got it wrong</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="jobTitle"
            label="Job title"
            placeholder="e.g. Business Analyst"
            value={jobTitle}
            onChange={(e) => {
              titleTouchedRef.current = true;
              setJobTitle(e.target.value);
            }}
          />
          <Input
            id="companyName"
            label="Company"
            placeholder="e.g. Woolworths Group"
            value={companyName}
            onChange={(e) => {
              companyTouchedRef.current = true;
              setCompanyName(e.target.value);
            }}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {limitReached && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            You&apos;ve used all {limitReached.limit} free resume generations. Upgrade for unlimited
            resumes, cover letters, and downloads.
          </p>
          <Link href="/upgrade" className="self-start">
            <Button type="button" size="sm">
              Upgrade now
            </Button>
          </Link>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="submit"
          isLoading={isGenerating}
          disabled={disabled || !!limitReached}
          className="self-start"
        >
          Generate resume
        </Button>
        {isGenerating && <p className="text-sm text-gray-500">{progressMessage}</p>}
        {!isGenerating && (
          <p className="text-xs text-gray-400">
            ~30-40s{!isPaidPlan && remaining !== null ? ` · ${remaining} of ${limit} free generations left` : ""}
          </p>
        )}
        {disabled && !isGenerating && (
          <p className="text-sm text-gray-500">Finish the required profile fields above to generate.</p>
        )}
      </div>
    </form>
  );
}
