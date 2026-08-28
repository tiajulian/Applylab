"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { OnboardingReviewForm } from "@/components/onboarding/OnboardingReviewForm";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { EASE } from "@/lib/motion";
import { GoalSelectionStep } from "@/components/onboarding/GoalSelectionStep";
import { TargetRoleStep } from "@/components/onboarding/TargetRoleStep";
import { JobHuntPainStep } from "@/components/onboarding/JobHuntPainStep";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import { ensureAnonymousSession } from "@/lib/onboarding/ensureAnonymousSession";
import { createClient } from "@/lib/supabase/client";
import type { ProfileFieldsInitial } from "@/lib/profile/useProfileFieldsState";
import type {
  CareerGoal,
  JobHuntPain,
  ParsedProfileFields,
  TargetRoleCategory,
  UserProfile,
} from "@/types";

type Step = "goal" | "target_role" | "job_hunt_pain" | "choose" | "resume" | "linkedin" | "review";
type SessionState = "checking" | "need_captcha" | "signing_in" | "ready" | "error";

function determineInitialStep(profile: UserProfile | null): Step {
  if (!profile?.career_goal) return "goal";
  if (!profile?.target_role) return "target_role";
  if (!profile?.job_hunt_pain) return "job_hunt_pain";
  return "choose";
}

function parsedToInitial(
  parsed: ParsedProfileFields,
  fallbackFullName: string,
  goal?: CareerGoal | null,
  targetRole?: TargetRoleCategory | string | null,
  jobHuntPain?: JobHuntPain | string | null
): ProfileFieldsInitial {
  return {
    career_goal: goal,
    target_role: targetRole,
    job_hunt_pain: jobHuntPain,
    fullName: parsed.fullName || fallbackFullName,
    work_rights: parsed.work_rights,
    phone: parsed.phone,
    location: parsed.location,
    linkedin_url: parsed.linkedin_url,
    skills: parsed.skills,
    work_experience: parsed.work_experience,
    projects: parsed.projects,
    education: parsed.education,
    referees: parsed.referees,
  };
}

async function saveIncremental(payload: Partial<ProfileFieldsInitial>) {
  try {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to incrementally persist onboarding state", err);
  }
}

export function OnboardingWizard({
  initialFullName,
  initialProfile,
}: {
  initialFullName: string;
  initialProfile: UserProfile | null;
}) {
  const [selectedGoal, setSelectedGoal] = useState<CareerGoal | null>(initialProfile?.career_goal ?? null);
  const [selectedRole, setSelectedRole] = useState<TargetRoleCategory | string | null>(
    initialProfile?.target_role ?? null
  );
  const [selectedPain, setSelectedPain] = useState<JobHuntPain | string | null>(
    initialProfile?.job_hunt_pain ?? null
  );
  const [step, setStep] = useState<Step>(() => determineInitialStep(initialProfile));
  const [reviewInitial, setReviewInitial] = useState<ProfileFieldsInitial>({});
  const [linkedinText, setLinkedinText] = useState(initialProfile?.raw_linkedin_paste ?? "");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [captchaRetryNeeded, setCaptchaRetryNeeded] = useState(false);
  const reduceMotion = useReducedMotion();

  // Check whether an active session already exists, or wait for captcha verification before creating one
  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setSessionState("ready");
        } else {
          setSessionState("need_captcha");
        }
      } catch {
        setSessionError("Something went wrong connecting to our service — please refresh and try again");
        setSessionState("error");
      }
    }
    checkSession();
  }, []);

  async function handleSessionCaptchaVerify(token: string) {
    setSessionState("signing_in");
    setSessionError(null);
    setCaptchaRetryNeeded(false);
    try {
      const supabase = createClient();
      const { error } = await ensureAnonymousSession(supabase, token);
      if (error) {
        setSessionError("Something went wrong starting your session — refresh and try again");
        setSessionState("error");
      } else {
        setSessionState("ready");
      }
    } catch {
      setSessionError("Something went wrong starting your session — refresh and try again");
      setSessionState("error");
    }
  }

  function handleRetrySession() {
    setSessionError(null);
    setCaptchaRetryNeeded(false);
    setSessionState("need_captcha");
    setCaptchaKey((k) => k + 1);
  }

  const scratchInitial: ProfileFieldsInitial = {
    career_goal: selectedGoal,
    target_role: selectedRole,
    job_hunt_pain: selectedPain,
    fullName: initialFullName,
    work_rights: initialProfile?.work_rights,
    phone: initialProfile?.phone,
    location: initialProfile?.location,
    linkedin_url: initialProfile?.linkedin_url,
    skills: initialProfile?.skills,
    tools: initialProfile?.tools,
    stakeholders: initialProfile?.stakeholders,
    work_experience: initialProfile?.work_experience,
    projects: initialProfile?.projects,
    education: initialProfile?.education,
    referees: initialProfile?.referees,
    raw_linkedin_paste: initialProfile?.raw_linkedin_paste,
  };

  function startFromScratch() {
    saveIncremental({
      career_goal: selectedGoal,
      target_role: selectedRole,
      job_hunt_pain: selectedPain,
    });
    setReviewInitial(scratchInitial);
    setStep("review");
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setIsParsing(true);

    const formData = new FormData();
    formData.append("file", file);
    if (turnstileToken) {
      formData.append("turnstileToken", turnstileToken);
    }

    const response = await fetch("/api/profile/parse", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    setIsParsing(false);

    if (!response.ok) {
      setTurnstileToken(null);
      setParseError(data.error ?? "We couldn't read that file. Paste your text instead.");
      return;
    }

    const initial = {
      ...parsedToInitial(
        data.profile as ParsedProfileFields,
        initialFullName,
        selectedGoal,
        selectedRole,
        selectedPain
      ),
      raw_linkedin_paste: initialProfile?.raw_linkedin_paste,
    };

    // Incrementally persist parsed fields immediately
    saveIncremental(initial);
    setReviewInitial(initial);
    setStep("review");
  }

  async function handleLinkedinSubmit(event: React.FormEvent) {
    event.preventDefault();
    setParseError(null);
    setIsParsing(true);

    const response = await fetch("/api/profile/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: linkedinText, turnstileToken }),
    });
    const data = await response.json().catch(() => ({}));
    setIsParsing(false);

    if (!response.ok) {
      setTurnstileToken(null);
      setParseError(data.error ?? "We couldn't extract anything from that text.");
      return;
    }

    const initial = {
      ...parsedToInitial(
        data.profile as ParsedProfileFields,
        initialFullName,
        selectedGoal,
        selectedRole,
        selectedPain
      ),
      raw_linkedin_paste: linkedinText,
    };

    // Incrementally persist parsed fields immediately
    saveIncremental(initial);
    setReviewInitial(initial);
    setStep("review");
  }

  if (sessionState === "error") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-critical/30 bg-surface p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-critical">
          {sessionError || "Something went wrong starting your session — refresh and try again"}
        </p>
        <Button type="button" onClick={handleRetrySession}>
          Try again
        </Button>
      </div>
    );
  }

  if (sessionState !== "ready") {
    return (
      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-base font-medium text-ink">
            {sessionState === "signing_in" ? "Starting your session…" : "Setting things up…"}
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <TurnstileWidget
            key={captchaKey}
            onVerify={handleSessionCaptchaVerify}
            onExpire={() => setCaptchaRetryNeeded(true)}
            onError={() => setCaptchaRetryNeeded(true)}
          />
          {captchaRetryNeeded && (
            <button
              type="button"
              className="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={handleRetrySession}
            >
              Couldn&apos;t verify — retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "review") {
    return <OnboardingReviewForm initial={reviewInitial} />;
  }

  const stepTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: EASE };

  return (
    <AnimatePresence mode="wait">
      {step === "goal" && (
        <GoalSelectionStep
          userFirstName={initialFullName}
          initialGoal={selectedGoal}
          onSelectGoal={(goal) => {
            setSelectedGoal(goal);
            saveIncremental({ career_goal: goal });
            setStep("target_role");
          }}
        />
      )}

      {step === "target_role" && (
        <TargetRoleStep
          initialRole={selectedRole}
          onSelectRole={(role) => {
            setSelectedRole(role);
            saveIncremental({ career_goal: selectedGoal, target_role: role });
            setStep("job_hunt_pain");
          }}
          onBack={() => setStep("goal")}
        />
      )}

      {step === "job_hunt_pain" && (
        <JobHuntPainStep
          initialPain={selectedPain}
          onSelectPain={(pain) => {
            setSelectedPain(pain);
            saveIncremental({
              career_goal: selectedGoal,
              target_role: selectedRole,
              job_hunt_pain: pain,
            });
            setStep("choose");
          }}
          onBack={() => setStep("target_role")}
        />
      )}

      {step === "resume" && (
        <motion.div
          key="resume"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={stepTransition}
          className="flex flex-col gap-6 rounded border border-border bg-surface p-8 text-center"
        >
          <div>
            <h2 className="text-h3 font-semibold text-ink">Upload your resume</h2>
            <p className="mt-1 text-sm text-ink-secondary">PDF or Word doc, up to 5 MB.</p>
          </div>
          <div className="mx-auto flex justify-center">
            <TurnstileWidget
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
            />
          </div>
          <label className={`mx-auto flex w-full max-w-sm flex-col items-center gap-2 rounded border-2 border-dashed border-border-strong p-8 text-sm text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent ${!turnstileToken ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
            <span>{fileName ?? "Click to choose a file"}</span>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={isParsing || !turnstileToken}
            />
          </label>
          {isParsing && <p className="text-sm text-ink-secondary">Reading your resume…</p>}
          {parseError && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-critical">{parseError}</p>
              <button
                type="button"
                className="rounded text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => {
                  setParseError(null);
                  setStep("linkedin");
                }}
              >
                Paste your text instead
              </button>
            </div>
          )}
          <div className="flex items-center justify-center gap-4 text-sm">
            <button
              type="button"
              className="rounded text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setStep("choose")}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={startFromScratch}
            >
              Continue from scratch instead
            </button>
          </div>
        </motion.div>
      )}

      {step === "linkedin" && (
        <motion.form
          key="linkedin"
          onSubmit={handleLinkedinSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={stepTransition}
          className="flex flex-col gap-4 rounded border border-border bg-surface p-8"
        >
          <div>
            <h2 className="text-h3 font-semibold text-ink">Paste your LinkedIn profile</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Open your LinkedIn profile, select all the page text (Ctrl/Cmd+A), copy it, and paste it
              below.
            </p>
          </div>
          <Textarea
            rows={10}
            placeholder="Paste your LinkedIn profile text here..."
            value={linkedinText}
            onChange={(e) => setLinkedinText(e.target.value)}
            required
          />

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <label className={`flex flex-col items-center gap-1 rounded border-2 border-dashed border-border-strong p-4 text-center text-sm text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent ${!turnstileToken ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
            <span>
              {fileName ?? "Upload the PDF LinkedIn generates for you"}
            </span>
            <span className="text-xs text-ink-muted">
              On your LinkedIn profile: the &ldquo;&hellip;&rdquo; menu next to Contact info &rarr; Save to PDF
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleResumeUpload}
              disabled={isParsing || !turnstileToken}
            />
          </label>

          <div className="flex justify-center">
            <TurnstileWidget
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
            />
          </div>

          {parseError && <p className="text-sm text-critical">{parseError}</p>}
          <div className="flex items-center gap-4">
            <Button type="submit" isLoading={isParsing} disabled={isParsing || !turnstileToken || !linkedinText.trim()}>
              Extract &amp; continue
            </Button>
            <button
              type="button"
              className="rounded text-sm text-ink-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setStep("choose")}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={startFromScratch}
            >
              Continue from scratch instead
            </button>
          </div>
        </motion.form>
      )}

      {step === "choose" && (
        <motion.div
          key="choose"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={stepTransition}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-h3 font-bold text-ink">How would you like to build your profile?</h2>
            <button
              type="button"
              onClick={() => setStep("job_hunt_pain")}
              className="text-xs text-ink-muted transition-colors hover:text-ink"
            >
              ← Back to questions
            </button>
          </div>
          <StaggerList className="grid gap-4 sm:grid-cols-3">
            <StaggerItem>
              <button
                type="button"
                onClick={() => setStep("resume")}
                className="flex h-full w-full flex-col items-center gap-2 rounded border-2 border-accent bg-accent-soft p-6 text-center transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-accent-soft/80 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-accent">Import resume</span>
                <span className="text-sm text-accent/80">
                  Upload a PDF or Word doc and we&apos;ll fill in the details.
                </span>
              </button>
            </StaggerItem>
            <StaggerItem>
              <button
                type="button"
                onClick={() => setStep("linkedin")}
                className="flex h-full w-full flex-col items-center gap-2 rounded border border-border bg-surface p-6 text-center transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-paper-deep active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-ink">Import from LinkedIn</span>
                <span className="text-sm text-ink-secondary">Paste your profile text and we&apos;ll extract it.</span>
              </button>
            </StaggerItem>
            <StaggerItem>
              <button
                type="button"
                onClick={startFromScratch}
                className="flex h-full w-full flex-col items-center gap-2 rounded border border-border bg-surface p-6 text-center transition-[background-color,transform] duration-fast ease-editorial hover:-translate-y-px hover:bg-paper-deep active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-base font-semibold text-ink">Start from scratch</span>
                <span className="text-sm text-ink-secondary">Fill in your details manually.</span>
              </button>
            </StaggerItem>
          </StaggerList>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
