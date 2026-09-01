"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { clsx } from "@/lib/utils";
import {
  MicIcon,
  LockIcon,
  KeyboardIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@/components/ui/icons/LucideIcons";
import {
  getHideQuestionTextPreference,
  setHideQuestionTextPreference,
} from "@/lib/interview/questionDisplayPreference";
import {
  STAGES,
  ANSWER_MODES,
  PRESSURE_OPTIONS,
  QUESTION_DISPLAY_OPTIONS,
  resolveStage,
  type AnswerMode,
  type PressureLevel,
} from "@/lib/interview/setupConstants";
import type {
  InterviewStageType,
  Resume,
  AppUser,
  Application,
  ApplicationInterview,
} from "@/types";

export interface InterviewSetupProps {
  resumes: Resume[];
  user: AppUser;
  applications?: Application[];
  interviews?: ApplicationInterview[];
  initialApplicationId?: string;
  initialStage?: string;
  initialInterviewId?: string;
}

export function InterviewSetup({
  resumes,
  user,
  applications = [],
  interviews = [],
  initialApplicationId,
  initialStage,
  initialInterviewId,
}: InterviewSetupProps) {
  const router = useRouter();

  const linkedApplication = initialApplicationId
    ? applications.find((a) => a.id === initialApplicationId)
    : null;

  const linkedInterview = initialInterviewId
    ? interviews.find((i) => i.id === initialInterviewId)
    : null;

  // Derive initial resume
  const defaultResumeId = (() => {
    if (linkedApplication?.resume_id) {
      const match = resumes.find((r) => r.id === linkedApplication.resume_id);
      if (match) return match.id;
    }
    return resumes.length > 0 ? resumes[0].id : "";
  })();

  const defaultStage = resolveStage(initialStage, linkedInterview?.stage_type);

  const [selectedResumeId, setSelectedResumeId] = useState<string>(defaultResumeId);
  const [selectedStage, setSelectedStage] = useState<InterviewStageType>(defaultStage);
  const [mode, setMode] = useState<AnswerMode>("voice");
  const [pressure, setPressure] = useState<PressureLevel>("realistic");
  const [hideQuestionText, setHideQuestionText] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [isChangingResume, setIsChangingResume] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [micTested, setMicTested] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isFreePlan = user.plan === "free";
  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];
  const selectedStageOption =
    STAGES.find((s) => s.type === selectedStage) || STAGES[0];

  // Grounding count calculated dynamically from real verified history
  const experienceBullets =
    selectedResume?.resume_content?.experience?.reduce(
      (acc, exp) => acc + (exp.bullets?.length || 0),
      0
    ) || 0;
  const projectBullets =
    selectedResume?.resume_content?.projects?.reduce(
      (acc, p) => acc + (p.bullets?.length || 0),
      0
    ) || 0;
  const totalTasks = experienceBullets + projectBullets;
  const totalSkills =
    (selectedResume?.resume_content?.skills?.length || 0) +
    (selectedResume?.resume_content?.tools?.length || 0);

  const groundingBadgeText =
    totalTasks > 0
      ? `Using ${totalTasks} tasks, ${totalSkills > 0 ? `${totalSkills} skills` : "verified history"}`
      : "Grounded in verified profile";

  const moreSettingsSummary = `${PRESSURE_OPTIONS[pressure].label}, ${
    hideQuestionText
      ? QUESTION_DISPLAY_OPTIONS.hear.shortLabel
      : QUESTION_DISPLAY_OPTIONS.show.shortLabel
  }`;

  // Hydration-safe initial preference load
  useEffect(() => {
    setHideQuestionText(getHideQuestionTextPreference());
  }, []);

  useEffect(() => {
    return () => {
      if (micTimeoutRef.current) clearTimeout(micTimeoutRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const updateMicLevel = useCallback(() => {
    if (!analyserRef.current || !isTestingMic) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
    animFrameRef.current = requestAnimationFrame(updateMicLevel);
  }, [isTestingMic]);

  async function testMicrophone() {
    setMicError(null);
    setIsTestingMic(true);
    if (micTimeoutRef.current) clearTimeout(micTimeoutRef.current);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        animFrameRef.current = requestAnimationFrame(updateMicLevel);
      }

      // Sample for 2.5 seconds to establish readiness
      micTimeoutRef.current = setTimeout(() => {
        setMicTested(true);
        setIsTestingMic(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      }, 2500);
    } catch (err: unknown) {
      console.error("Mic test error", err);
      setIsTestingMic(false);
      const isDenied = (err as { name?: string })?.name === "NotAllowedError";
      setMicError(
        isDenied
          ? "Microphone permission denied in browser settings. Enable mic access or select Typed mode."
          : "Could not access microphone. Typed fallback is always available."
      );
    }
  }

  function handleStageKeyDown(e: React.KeyboardEvent, currentIndex: number) {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % STAGES.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + STAGES.length) % STAGES.length;
    }
    if (nextIndex >= 0) {
      setSelectedStage(STAGES[nextIndex].type);
    }
  }

  function handleModeKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setMode((prev) => (prev === "voice" ? "text" : "voice"));
    }
  }



  async function handleStartSession() {
    if (!selectedResumeId) {
      setErrorMsg("Please select a target job or resume.");
      return;
    }

    setIsStarting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/interview/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_id: selectedResumeId,
          stage_type: selectedStage,
          answer_mode: mode,
          pressure_level: pressure,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start interview session");
      }

      router.push(`/interview/${data.sessionId}`);
    } catch (err: unknown) {
      console.error("Start session error", err);
      setErrorMsg(
        (err as Error).message || "Failed to launch interview session"
      );
      setIsStarting(false);
    }
  }

  if (isFreePlan) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MicIcon className="w-6 h-6" strokeWidth={2.75} />
        </div>
        <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
          AI Mock Interview Prep is a Pro Feature
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-secondary leading-relaxed">
          Rehearse spoken questions grounded strictly in your real work history,
          practice honest missing skill handling, and receive calibrated feedback.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/upgrade" variant="primary" size="lg" className="rounded-pill">
            Upgrade to Pro to Practise
          </Button>
          <Button href="/dashboard" variant="secondary" size="lg" className="rounded-pill">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-ink">No Resumes Found</h2>
        <p className="mt-2 text-sm text-ink-secondary">
          Interview prep anchors questions to a target job description and your real tailored resume.
        </p>
        <div className="mt-6">
          <Button href="/resume/new" variant="primary" className="rounded-pill">
            Create Your First Resume
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header (Full Width) */}
      <div className="flex flex-col items-start text-left">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
          INTERVIEW COACH
        </span>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-[44px] lg:leading-[1.04] font-semibold text-ink max-w-[20ch]">
          Practise before the real thing
        </h1>
        <p className="mt-3 text-[16.5px] leading-[1.6] text-ink-secondary max-w-[62ch]">
          We ask you real questions about this job, you answer out loud, you get feedback, and everything comes from your own work history.
        </p>

        {linkedApplication && (
          <div className="mt-4 flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft/50 p-3.5">
            <CheckIcon className="w-4 h-4 text-accent shrink-0" strokeWidth={2.75} />
            <div className="flex flex-col">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                Rehearsing scheduled round
              </span>
              <span className="text-sm font-semibold text-ink">
                {linkedApplication.job_title} at {linkedApplication.company_name} ({selectedStageOption.title})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 min-[1080px]:grid-cols-[minmax(0,1fr)_348px] gap-[30px] items-start">
        {/* Left Column: Context, Decision 1, Decision 2, More Settings */}
        <div className="flex flex-col gap-6">
          {/* Job Context Strip (Horizontal Card) */}
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              {/* Role & Company */}
              <div className="min-w-[180px] flex-1">
                <div className="font-semibold text-ink text-base leading-snug truncate">
                  {selectedResume?.job_title || "Target Role"}
                </div>
                <div className="text-xs text-ink-secondary mt-0.5 truncate">
                  {selectedResume?.company_name || "Target Company"}
                </div>
              </div>

              {/* Grounding Badge */}
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1 text-xs font-medium text-success">
                  <CheckIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.75} />
                  <span>{groundingBadgeText}</span>
                </span>
              </div>

              {/* Change Button */}
              {resumes.length > 1 && (
                <div className="flex items-center sm:ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsChangingResume((prev) => !prev)}
                    className="text-xs rounded-pill"
                  >
                    {isChangingResume ? "Done" : "Change"}
                  </Button>
                </div>
              )}
            </div>

            {/* Inline Resume Selector if toggled */}
            {isChangingResume && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold text-ink mb-2">Select a different target resume:</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {resumes.map((r) => {
                    const isSel = r.id === selectedResumeId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setSelectedResumeId(r.id);
                          setIsChangingResume(false);
                        }}
                        className={clsx(
                          "flex flex-col items-start rounded-lg border p-3 text-left transition-all text-xs focus-visible:outline-2 focus-visible:outline-accent",
                          isSel
                            ? "border-accent bg-accent-soft/30 font-medium text-ink"
                            : "border-border bg-paper hover:bg-paper-deep text-ink-secondary hover:text-ink"
                        )}
                      >
                        <span className="font-semibold text-ink">{r.job_title || "Untitled Role"}</span>
                        <span>{r.company_name || "Company"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Decision 1: What kind of interview are you practising for? */}
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
              What kind of interview are you practising for?
            </h2>

            <div
              role="radiogroup"
              aria-label="What kind of interview are you practising for?"
              className="grid grid-cols-1 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3 gap-3.5 items-stretch"
            >
              {STAGES.map((s, idx) => {
                const isSelected = s.type === selectedStage;
                return (
                  <button
                    key={s.type}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedStage(s.type)}
                    onKeyDown={(e) => handleStageKeyDown(e, idx)}
                    className={clsx(
                      "relative flex flex-col p-4 rounded-lg bg-surface border border-border text-left cursor-pointer transition-all duration-fast select-none",
                      "hover:shadow-pop hover:-translate-y-0.5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                      isSelected && "shadow-sm"
                    )}
                  >
                    {/* Selected Ring and Tint Overlay */}
                    {isSelected && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-[-1px] rounded-lg border-2 border-accent bg-accent-soft pointer-events-none -z-0"
                      />
                    )}

                    <div className="relative z-10 flex flex-col flex-1 justify-between gap-3 w-full">
                      <div>
                        {/* 1. Title + Tag */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-[15px] leading-[1.25] text-ink">
                            {s.title}
                          </span>
                          {s.badge && (
                            <Badge
                              variant={s.badgeVariant || "accent"}
                              className="ml-auto shrink-0 text-[11px] px-2 py-0.5 rounded-pill"
                            >
                              {s.badge}
                            </Badge>
                          )}
                        </div>

                        {/* 2. Description (fits 2 lines without clamping) */}
                        <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
                          {s.description}
                        </p>
                      </div>

                      {/* 3. Meta Row pinned to bottom */}
                      <div className="text-[11.5px] font-medium text-ink-muted border-t border-border pt-2.5 mt-auto">
                        {s.meta}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Decision 2: How do you want to answer? */}
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
              How do you want to answer?
            </h2>

            <div
              role="radiogroup"
              aria-label="How do you want to answer?"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch"
            >
              {/* Out loud card */}
              <button
                type="button"
                role="radio"
                aria-checked={mode === "voice"}
                onClick={() => setMode("voice")}
                onKeyDown={handleModeKeyDown}
                className={clsx(
                  "relative flex flex-col p-4 sm:p-5 rounded-lg bg-surface border border-border text-left cursor-pointer transition-all duration-fast select-none",
                  "hover:shadow-pop hover:-translate-y-0.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  mode === "voice" && "shadow-sm"
                )}
              >
                {mode === "voice" && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-[-1px] rounded-lg border-2 border-accent bg-accent-soft pointer-events-none -z-0"
                  />
                )}
                <div className="relative z-10 flex flex-col flex-1 justify-between w-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MicIcon className="w-4 h-4 text-accent shrink-0" strokeWidth={2.75} />
                      <span className="font-bold text-[15px] leading-[1.25] text-ink">
                        {ANSWER_MODES.voice.title}
                      </span>
                    </div>
                    {ANSWER_MODES.voice.badge && (
                      <Badge
                        variant="accent"
                        className="ml-auto shrink-0 text-[11px] px-2 py-0.5 rounded-pill"
                      >
                        {ANSWER_MODES.voice.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
                    {ANSWER_MODES.voice.description}
                  </p>
                </div>
              </button>

              {/* Typed card */}
              <button
                type="button"
                role="radio"
                aria-checked={mode === "text"}
                onClick={() => setMode("text")}
                onKeyDown={handleModeKeyDown}
                className={clsx(
                  "relative flex flex-col p-4 sm:p-5 rounded-lg bg-surface border border-border text-left cursor-pointer transition-all duration-fast select-none",
                  "hover:shadow-pop hover:-translate-y-0.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  mode === "text" && "shadow-sm"
                )}
              >
                {mode === "text" && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-[-1px] rounded-lg border-2 border-accent bg-accent-soft pointer-events-none -z-0"
                  />
                )}
                <div className="relative z-10 flex flex-col flex-1 justify-between w-full">
                  <div className="flex items-center gap-2">
                    <KeyboardIcon className="w-4 h-4 text-ink-secondary shrink-0" strokeWidth={2.75} />
                    <span className="font-bold text-[15px] leading-[1.25] text-ink">
                      {ANSWER_MODES.text.title}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.5] text-ink-muted">
                    {ANSWER_MODES.text.description}
                  </p>
                </div>
              </button>
            </div>

            {/* Microphone Status Strip (Only rendered when speaking is selected) */}
            {mode === "voice" && (
              <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Level Meter & Device Status */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
                    {[...Array(8)].map((_, i) => (
                      <span
                        key={i}
                        style={{
                          height: isTestingMic
                            ? `${Math.max(6, Math.min(24, micLevel * (0.4 + (i % 4) * 0.2)))}px`
                            : "100%",
                          animationDelay: `${i * 0.12}s`,
                        }}
                        className={clsx(
                          "w-[5px] rounded-pill bg-success transition-all duration-fast",
                          !isTestingMic && "audio-bar-pulse"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-ink">
                      {isTestingMic
                        ? "Listening..."
                        : micTested
                        ? "Microphone ready"
                        : "Microphone ready"}
                    </span>
                    <span className="text-[11px] text-ink-muted">
                      Default audio input
                    </span>
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden md:block h-8 w-px bg-border" />

                {/* Privacy Statement */}
                <div className="flex items-center gap-2 max-w-sm">
                  <LockIcon className="w-4 h-4 shrink-0 text-ink-muted" strokeWidth={2.75} />
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    Audio is processed in real time and never stored.
                  </p>
                </div>

                {/* Test Mic Button */}
                <div className="flex items-center sm:ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testMicrophone}
                    isLoading={isTestingMic}
                    className="text-xs rounded-pill"
                  >
                    {micTested ? "Microphone ready" : "Test microphone"}
                  </Button>
                </div>
              </div>
            )}

            {micError && (
              <div className="rounded-lg bg-critical-soft p-3 text-xs text-critical">
                {micError}
              </div>
            )}
          </section>

          {/* More Settings Disclosure */}
          <section className="flex flex-col">
            <button
              type="button"
              aria-expanded={advOpen}
              onClick={() => setAdvOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-surface hover:bg-paper-deep transition-colors text-left shadow-sm focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="font-semibold text-sm text-ink">More settings</span>
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span>{moreSettingsSummary}</span>
                <ChevronDownIcon
                  className={clsx(
                    "w-4 h-4 transition-transform duration-fast text-ink-secondary",
                    advOpen && "rotate-180"
                  )}
                  strokeWidth={2.75}
                />
              </div>
            </button>

            {advOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch mt-3">
                {/* How tough should it be? */}
                <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                    HOW TOUGH SHOULD IT BE?
                  </span>
                  <div className="inline-flex w-full rounded-pill bg-paper-deep p-1">
                    {(["supportive", "realistic", "tough"] as PressureLevel[]).map(
                      (pLevel) => (
                        <button
                          key={pLevel}
                          type="button"
                          onClick={() => setPressure(pLevel)}
                          className={clsx(
                            "flex-1 flex items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                            pressure === pLevel
                              ? "bg-accent text-on-accent font-semibold shadow-sm"
                              : "text-ink-secondary hover:text-ink"
                          )}
                        >
                          {PRESSURE_OPTIONS[pLevel].label}
                        </button>
                      )
                    )}
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-ink-muted mt-auto pt-1">
                    {PRESSURE_OPTIONS[pressure].hint}
                  </p>
                </div>

                {/* Seeing the questions */}
                <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                    SEEING THE QUESTIONS
                  </span>
                  <div className="inline-flex w-full rounded-pill bg-paper-deep p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setHideQuestionText(false);
                        setHideQuestionTextPreference(false);
                      }}
                      className={clsx(
                        "flex-1 flex items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                        !hideQuestionText
                          ? "bg-accent text-on-accent font-semibold shadow-sm"
                          : "text-ink-secondary hover:text-ink"
                      )}
                    >
                      {QUESTION_DISPLAY_OPTIONS.show.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHideQuestionText(true);
                        setHideQuestionTextPreference(true);
                      }}
                      className={clsx(
                        "flex-1 flex items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                        hideQuestionText
                          ? "bg-accent text-on-accent font-semibold shadow-sm"
                          : "text-ink-secondary hover:text-ink"
                      )}
                    >
                      {QUESTION_DISPLAY_OPTIONS.hear.label}
                    </button>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-ink-muted mt-auto pt-1">
                    {hideQuestionText
                      ? QUESTION_DISPLAY_OPTIONS.hear.hint
                      : QUESTION_DISPLAY_OPTIONS.show.hint}
                  </p>
                </div>
              </div>
            )}
          </section>

          {errorMsg && (
            <div className="rounded-lg bg-critical-soft p-4 text-sm text-critical">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Right Column: Sticky Rail */}
        <div className="sticky top-[88px] flex flex-col gap-3.5">
          {/* 1. Session Summary Card */}
          <div className="rounded-lg border border-border bg-surface p-5 shadow-pop flex flex-col gap-4">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                YOUR PRACTICE SESSION
              </span>
              <h3 className="mt-1 font-display text-[21px] font-bold text-ink leading-tight">
                {selectedStageOption.title}
              </h3>
              <p className="mt-0.5 text-[13px] text-ink-secondary leading-snug">
                {selectedStageOption.persona}
              </p>
            </div>

            {/* Nested Stat Panel */}
            <div className="rounded-lg border border-border/60 bg-paper-deep/40 p-3.5 flex flex-col gap-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">How long</span>
                <span className="font-semibold text-ink">{selectedStageOption.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Questions</span>
                <span className="font-semibold text-ink">{selectedStageOption.questions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Answering by</span>
                <span className="font-semibold text-ink">
                  {ANSWER_MODES[mode].railLabel}
                </span>
              </div>
              <div className="border-t border-border/50 pt-2 flex flex-col gap-1">
                <span className="text-ink-muted">Feedback on</span>
                <span className="font-medium text-ink leading-snug text-[11.5px]">
                  {selectedStageOption.feedbackOn}
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartSession}
              isLoading={isStarting}
              disabled={!selectedResumeId}
              className="w-full justify-center text-base font-semibold py-3 rounded-pill"
            >
              Start practising
            </Button>

            {/* Reassurance copy */}
            <p className="text-center text-[12px] text-ink-muted leading-relaxed">
              Pause or end at any point. Your feedback is saved either way.
            </p>
          </div>

          {/* 2. Grounding Card */}
          <div className="rounded-lg bg-success-soft border border-success/20 p-5 flex flex-col gap-2 shadow-sm">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-success">
              WE NEVER MAKE THINGS UP
            </span>
            <p className="text-[13px] leading-relaxed text-ink-secondary font-normal">
              Every question comes from your target job and real experience. If there is something you have not done, we help you practise saying so honestly, without making things up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
