"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { JobTitleInput } from "@/components/profile/JobTitleInput";
import { Textarea } from "@/components/ui/Textarea";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { SkillsBridgeReview } from "@/components/resume/SkillsBridgeReview";
import { GenerationStepper } from "@/components/resume/GenerationStepper";
import { QuotaIndicator } from "@/components/resume/QuotaIndicator";
import { Reveal } from "@/components/ui/Reveal";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import type { CheckInput } from "@/lib/text/preGenerateCheck";
import { useJobAdAutofill } from "@/lib/hooks/useJobAdAutofill";
import { GenerationProgress } from "@/components/resume/GenerationProgress";
import type { ProjectEntry, SkillsBridge, SkillsBridgeItem } from "@/types";
import { ExternalLinkIcon, UserIcon } from "@/components/ui/icons/LucideIcons";
import { CatalogInput } from "@/components/ui/CatalogInput";
import { COMPANY_CATALOG } from "@/lib/catalogs/companies";
import { useAccountGate } from "@/components/auth/AccountGate";
import type { ListingForResume } from "@/lib/jobs/listingForResume";
import { ResumeFileDrop } from "@/components/resume/ResumeFileDrop";
import { TIMED_OUT_MESSAGE, useResumeUpload } from "@/lib/hooks/useResumeUpload";
import { importedProfileToUserProfile } from "@/lib/resume/importedProfile";

/** What the fit check (and the resume after it) reads: the saved profile, or an uploaded file. */
export type TailoredSource = "profile" | "upload";

const MATCHING_STAGES = [
  "Reading the job ad…",
  "Working out what they need…",
  "Checking your profile…",
  "Finding what's missing…",
];

const UPLOAD_MATCHING_STAGES = [
  "Reading your resume…",
  "Reading the job ad…",
  "Working out what they need…",
  "Finding what's missing…",
];

const linkButtonClass =
  "font-semibold text-accent-hover underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/**
 * "Tailor resume & apply" from Find jobs: which job this is for, and the one thing to do. Job
 * listings only include a short preview of the ad, so the full text is pasted in (the steps below).
 */
function ListingSteps({ listing }: { listing: ListingForResume }) {
  return (
    <div className="mb-3 rounded-lg border border-accent/25 bg-accent-soft/40 p-4">
      <p className="text-[14.5px] text-ink">
        You&apos;re tailoring a resume for <strong className="font-semibold">{listing.title || "this job"}</strong>
        {listing.company && (
          <>
            {" "}at <strong className="font-semibold">{listing.company}</strong>
          </>
        )}
        {listing.location && <span className="text-ink-secondary"> · {listing.location}</span>}
      </p>
      <ol className="mt-2.5 flex flex-col gap-1.5 text-[13.5px] text-ink-secondary">
        <li className="flex items-start gap-2.5">
          <StepDot n={1} />
          <a
            href={listing.url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 font-semibold text-accent-hover underline underline-offset-4 hover:text-accent"
          >
            Open the job ad <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
        <li className="flex items-start gap-2.5">
          <StepDot n={2} />
          Select all the ad&apos;s text and copy it
        </li>
        <li className="flex items-start gap-2.5">
          <StepDot n={3} />
          Come back and paste it in the box below
        </li>
      </ol>
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink-secondary ring-1 ring-border"
    >
      {n}
    </span>
  );
}

export function ResumeForm({
  disabled = false,
  isPaidPlan,
  remaining,
  limit,
  profileCheck,
  listing = null,
  source,
  onSourceChange,
}: {
  /** Blocks the profile source only: an upload doesn't read the profile. */
  disabled?: boolean;
  isPaidPlan: boolean;
  remaining: number | null;
  limit: number;
  /** Profile text to spell/grammar-check before generating (with the job ad); no check when omitted. */
  profileCheck?: CheckInput;
  /** The Find jobs listing this resume is for: pre-fills title/company and is linked on the resume. */
  listing?: ListingForResume | null;
  source: TailoredSource;
  onSourceChange: (source: TailoredSource) => void;
}) {
  const [jobTitle, setJobTitle] = useState(listing?.title ?? "");
  const [companyName, setCompanyName] = useState(listing?.company ?? "");
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Read after any await (e.g. the signup step), when the widget may have issued a fresh token.
  const turnstileTokenRef = useRef(turnstileToken);
  turnstileTokenRef.current = turnstileToken;
  // Two separate error states: `adError` is specifically about the job-ad field (tied to the
  // textarea's red-border affordance), `error` is a generic form-level failure (a 500, a
  // timeout, etc.) that has nothing to do with what's in the ad text — conflating the two would
  // visually blame the textarea for problems that aren't about its content.
  const [adError, setAdError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  // Separate from `limitReached` above (which reflects skills-bridge's own free-tier-feature cap,
  // set only after a failed /api/skills-bridge call): this opens proactively, before any request
  // is made, the moment a free user whose resume-generation quota is already exhausted tries to
  // start a bridge that could only ever dead-end at that same limit.
  const [resumeLimitModalOpen, setResumeLimitModalOpen] = useState(false);
  // Set once /api/skills-bridge returns - switches the form over to the bridge review step.
  // Quota (resumes_used) isn't touched by reaching this state; that only happens once the user
  // clicks "Build resume from this bridge" inside SkillsBridgeReview.
  const [bridgeState, setBridgeState] = useState<{
    bridge: SkillsBridge;
    items: SkillsBridgeItem[];
    roles?: Array<{ company: string; job_title: string }>;
    projects?: ProjectEntry[];
    /** Set when the check ran against an uploaded file, so the resume is written from it too. */
    importedProfile?: unknown;
  } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const { parse: parseUpload, takeToken, captchaWidget } = useResumeUpload(setError);
  const usesUpload = source === "upload";
  const profileBlocked = disabled && !usesUpload;

  const { titleTouchedRef, companyTouchedRef, handleJobDescriptionPaste, handleJobDescriptionBlur, fillFromAd } =
    useJobAdAutofill({
      setJobTitle,
      setCompanyName,
      prefilled: listing ? { title: Boolean(listing.title), company: Boolean(listing.company) } : undefined,
    });
  const { requireAccount } = useAccountGate();

  // A skills bridge only feeds into generating a resume (see handleBuildResume in
  // SkillsBridgeReview), so once the free resume-generation quota itself is exhausted there is no
  // point letting a free user start a new bridge - it would just dead-end at that same limit two
  // steps later. Gated on the resume quota (`remaining`/`limit`), not skills-bridge's own separate
  // free-tier-feature counter (FREE_TIER_FEATURE_LIMITS["skills-bridge"] in lib/requireUser.ts),
  // which exists to rate-limit bridge analyses themselves, not to track whether a resume can still
  // be built from one.
  const resumeQuotaExhausted = !isPaidPlan && remaining !== null && remaining <= 0;
  const showJobFields = Boolean(listing || jobDescription.trim() || jobTitle || companyName);

  // Guards the gap between a click and isAnalyzing (the account check awaits first), so a fast
  // double-click can't send two fit checks with the same single-use Turnstile token.
  const submittingRef = useRef(false);

  function switchSource(next: TailoredSource) {
    // An error from the other source doesn't apply to this one.
    setError(null);
    onSourceChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await submit();
    } finally {
      submittingRef.current = false;
    }
  }

  async function submit() {
    setError(null);
    setAdError(null);

    if (resumeQuotaExhausted) {
      setResumeLimitModalOpen(true);
      return;
    }

    if (!jobDescription.trim()) {
      setAdError("Paste the job ad to continue");
      return;
    }

    if (usesUpload && !file) {
      setError("Choose your resume file first.");
      return;
    }

    const canUseAi = await requireAccount({
      title: "Create your free account to check your fit",
      subtitle: `ApplyLab compares your ${usesUpload ? "resume" : "profile"} to this job ad. It's free, and everything you've entered is kept.`,
      submitLabel: "Create account & check my fit",
    });
    if (!canUseAi) return;

    setIsAnalyzing(true);

    // Wrapped in try/catch/finally: a network failure, or a non-JSON response (e.g. a platform
    // timeout page, which isn't JSON), used to throw out of an unguarded response.json() call
    // here and leave isAnalyzing stuck true forever — the button would spin indefinitely with no
    // error ever shown.
    try {
      // A guest's paste skipped the title/company autofill (and any paste can fail quietly). If the
      // title is still empty, read the ad now, before the fit check, so the check (and the saved
      // analysis) has the role in it. Free when the ad was already read, and joins a read still in
      // flight. Started before the file parse, not after it: `jobTitle` here is the value from the
      // click, so an autofill finishing during the parse would otherwise leave the title empty.
      const titleRead = jobTitle.trim() ? null : fillFromAd(jobDescription);

      let importedProfile: unknown = undefined;
      // An upload takes both of its tokens (parse, then fit check) from the hook's one widget.
      let uploadToken: string | null = null;
      if (usesUpload && file) {
        importedProfile = await parseUpload(file);
        // parseUpload has already shown why.
        if (!importedProfile) return;
        // Caught here rather than by the server's same check, so it doesn't use up a fit check.
        if (importedProfileToUserProfile(importedProfile, null, "").profile.work_experience.length === 0) {
          setError("We couldn't find any work experience in that file. Try another one, or use your profile.");
          return;
        }
        uploadToken = await takeToken();
        if (!uploadToken) {
          setError("We couldn't confirm you're not a bot. Please try again.");
          return;
        }
      }

      const filled = await titleRead;
      const title = filled?.title ?? jobTitle;
      const company = filled?.company ?? companyName;

      const response = await fetch("/api/skills-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: title,
          companyName: company,
          jobDescription,
          turnstileToken: usesUpload ? uploadToken : turnstileTokenRef.current,
          ...(importedProfile ? { source: "upload", importedProfile } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTurnstileToken(null);
        if (data.code === "FREE_LIMIT_REACHED") {
          setLimitReached(true);
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setBridgeState({
        bridge: data.bridge,
        items: data.items,
        roles: data.roles ?? [],
        projects: data.projects ?? [],
        importedProfile,
      });
    } catch {
      setTurnstileToken(null);
      setError(TIMED_OUT_MESSAGE);
    } finally {
      setIsAnalyzing(false);
    }
  }

  if (bridgeState) {
    return (
      <div className="flex flex-col gap-4">
        <GenerationStepper currentStep={2} />
        <SkillsBridgeReview
          bridge={bridgeState.bridge}
          initialItems={bridgeState.items}
          roles={bridgeState.roles ?? []}
          jobTitle={jobTitle}
          companyName={companyName}
          jobDescription={jobDescription}
          jobUrl={listing?.url}
          importedProfile={bridgeState.importedProfile}
          isPaidPlan={isPaidPlan}
          remaining={remaining}
          limit={limit}
          // The spelling check reads profile text, which a resume from a file isn't written from.
          profileCheck={bridgeState.importedProfile ? undefined : profileCheck}
          onBack={() => setBridgeState(null)}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
      <GenerationStepper currentStep={1} />

      <LimitReachedModal
        isOpen={limitReached}
        onClose={() => setLimitReached(false)}
        title="You've used your free skill gap fixes"
        message="Go Pro for unlimited skill gap fixes on every application."
      />

      <LimitReachedModal
        isOpen={resumeLimitModalOpen}
        onClose={() => setResumeLimitModalOpen(false)}
        title="You've used your free resumes"
        message={`You've used all ${limit} of your free resume generations. Upgrade for unlimited resumes, cover letters, and downloads.`}
      />

      <div className="flex flex-col gap-2">
        {listing && <ListingSteps listing={listing} />}
        <label htmlFor="jobDescription" className="text-[16px] font-semibold text-ink">
          Paste the job ad
        </label>
        <Textarea
          id="jobDescription"
          placeholder="Copy the whole ad from SEEK, LinkedIn or the company's website and paste it here…"
          className="min-h-[150px]"
          rows={7}
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

      {/* Filled in from the ad, so they only appear once there is an ad (or a listing) to read. */}
      {showJobFields && (
        <Reveal className="flex flex-col gap-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <JobTitleInput
              id="jobTitle"
              label="Job title"
              placeholder="e.g. Business Analyst"
              value={jobTitle}
              onValueChange={(value) => {
                titleTouchedRef.current = true;
                setJobTitle(value);
              }}
            />
            <CatalogInput
              id="companyName"
              label="Company"
              placeholder="e.g. Woolworths Group"
              catalog={COMPANY_CATALOG}
              value={companyName}
              onValueChange={(value) => {
                companyTouchedRef.current = true;
                setCompanyName(value);
              }}
            />
          </div>
          <p className="text-[12.5px] text-ink-muted">Filled in from the ad. Fix them if they&apos;re wrong.</p>
        </Reveal>
      )}

      {/* The profile is the default; a file is one quiet link away, so most people never see it. */}
      {!isAnalyzing &&
        (usesUpload ? (
          <div className="flex flex-col gap-2">
            <ResumeFileDrop
              file={file}
              onFileChange={(next) => {
                setError(null);
                setFile(next);
              }}
            />
            <p className="text-[12.5px] text-ink-muted">
              Only what&apos;s in your file is used. Anything new in it is added to your profile.{" "}
              <button
                type="button"
                onClick={() => switchSource("profile")}
                className={linkButtonClass}
              >
                Use my profile instead
              </button>
            </p>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-secondary">
            <UserIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
            Matching against your profile
            {/* Only a separator when both fit on one line; on a phone the link wraps under it. */}
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <button
              type="button"
              onClick={() => switchSource("upload")}
              className={linkButtonClass}
            >
              Use a resume file instead
            </button>
          </p>
        ))}

      {error && <p className="text-sm text-critical">{error}</p>}

      {isAnalyzing && (
        <GenerationProgress stages={usesUpload ? UPLOAD_MATCHING_STAGES : MATCHING_STAGES} intervalMs={2400} showPercent>
          <p className="text-[11px] text-ink-muted">
            Compared only against your {usesUpload ? "file" : "profile"}. We never invent experience you haven&apos;t
            shared.
          </p>
        </GenerationProgress>
      )}

      <div className="flex flex-col items-start gap-3 border-t border-border pt-5">
        {/* Stays mounted while a click waits on it; hidden unless Cloudflare needs a click. */}
        {usesUpload && captchaWidget}
        {/* Interaction-only: Cloudflare shows the widget only when it needs the user to click. */}
        {!isAnalyzing && !usesUpload && (
          <TurnstileWidget
            appearance="interaction-only"
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            type="submit"
            isLoading={isAnalyzing}
            // Stays visually disabled but not natively `disabled` when the resume quota is
            // exhausted: a native `disabled` button never dispatches a click event, which would
            // silently swallow the tap instead of surfacing the resumeLimitModalOpen popup that
            // handleSubmit opens for this case.
            disabled={
              resumeQuotaExhausted
                ? isAnalyzing
                : (usesUpload ? !file : disabled || !turnstileToken) || isAnalyzing
            }
            className={resumeQuotaExhausted ? "opacity-50 hover:-translate-y-0 active:translate-y-0" : undefined}
          >
            {isAnalyzing ? "Checking your fit…" : "See how I match this job"}
          </Button>
          {!isAnalyzing && !resumeQuotaExhausted && !profileBlocked && (
            <span className="text-[13px] text-ink-muted">Takes about 20 seconds</span>
          )}
        </div>
        {/* One quota line: QuotaIndicator already covers both "N left" and "all used". */}
        {!isAnalyzing && (
          <QuotaIndicator isFreePlan={!isPaidPlan} remaining={remaining ?? 0} limit={limit} />
        )}
        {profileBlocked && !resumeQuotaExhausted && !isAnalyzing && (
          <p className="text-sm text-ink-secondary">
            Fill in the profile details above first, or{" "}
            <button
              type="button"
              onClick={() => switchSource("upload")}
              className={linkButtonClass}
            >
              use a resume file
            </button>{" "}
            instead.
          </p>
        )}
      </div>
    </form>
  );
}
