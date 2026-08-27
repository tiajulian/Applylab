"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { clsx } from "@/lib/utils";
import { MicIcon, LockIcon, KeyboardIcon, CheckIcon } from "@/components/ui/icons/LucideIcons";
import type { InterviewStageType, Resume, AppUser, Application, ApplicationInterview } from "@/types";

export interface InterviewSetupProps {
  resumes: Resume[];
  user: AppUser;
  applications?: Application[];
  interviews?: ApplicationInterview[];
  initialApplicationId?: string;
  initialStage?: string;
  initialInterviewId?: string;
}

interface StageOption {
  type: InterviewStageType;
  title: string;
  badge: string;
  badgeVariant: "accent" | "neutral" | "attention" | "success";
  description: string;
  meta: string;
  length: string;
  questions: string;
  persona: string;
  scoredOn: string;
}

const STAGES: StageOption[] = [
  {
    type: "technical",
    title: "Technical & Practical",
    badge: "Simulated",
    badgeVariant: "accent",
    description: "Deep dive into real systems and architecture tradeoffs.",
    meta: "35 min · 8 questions",
    length: "35 min",
    questions: "8 questions",
    persona: "Senior Technical Interviewer",
    scoredOn: "Technical depth · Architecture tradeoffs · Gap candour",
  },
  {
    type: "panel",
    title: "Panel Interview",
    badge: "Multi-Persona",
    badgeVariant: "neutral",
    description: "Multi-interviewer rotation across core competencies.",
    meta: "40 min · 10 questions",
    length: "40 min",
    questions: "10 questions",
    persona: "Hiring Manager + Technical Lead + Cross-Functional Partner",
    scoredOn: "Stakeholder management · STAR execution · Cross-functional breadth",
  },
  {
    type: "async_video",
    title: "Async Video",
    badge: "One-Way",
    badgeVariant: "neutral",
    description: "One-way video prompts with strict 2-minute ceilings.",
    meta: "20 min · 5 questions",
    length: "20 min",
    questions: "5 questions",
    persona: "Automated Video Assessment",
    scoredOn: "Time ceiling discipline · Rapid STAR structure · Impact delivery",
  },
  {
    type: "group",
    title: "Assessment Centre",
    badge: "Coached",
    badgeVariant: "attention",
    description: "Coached walkthrough of group dynamics and rubrics.",
    meta: "25 min · Walkthrough",
    length: "25 min",
    questions: "Walkthrough",
    persona: "Senior Assessment Centre Coach",
    scoredOn: "Group facilitation · Consensus building · Structured synthesis",
  },
  {
    type: "general",
    title: "General Behavioural",
    badge: "Simulated",
    badgeVariant: "success",
    description: "High-yield behavioural questions on delivery and wins.",
    meta: "30 min · 8 questions",
    length: "30 min",
    questions: "8 questions",
    persona: "Hiring Manager & Department Lead",
    scoredOn: "Classic STAR execution · Metric clarity · Ownership & impact",
  },
  {
    type: "phone_screen",
    title: "Phone Screen",
    badge: "Simulated",
    badgeVariant: "accent",
    description: "High-level screening on background, motivation and fit.",
    meta: "15 min · 6 questions",
    length: "15 min",
    questions: "6 questions",
    persona: "Talent Acquisition Specialist",
    scoredOn: "Motivation · Role alignment · Communication clarity",
  },
];

type AnswerMode = "voice" | "text";
type PressureLevel = "supportive" | "realistic" | "tough";

function resolveStage(
  stageParam?: string,
  interviewStage?: string
): InterviewStageType {
  const raw = (interviewStage || stageParam || "").toLowerCase();
  if (raw === "phone_screen" || raw === "screening") return "phone_screen";
  if (raw === "technical") return "technical";
  if (raw === "panel") return "panel";
  if (raw === "async_video") return "async_video";
  if (raw === "group" || raw === "assessment_centre") return "group";
  return "general";
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

  const isFreePlan = user.plan === "free";
  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];
  const selectedStageOption = STAGES.find((s) => s.type === selectedStage) || STAGES[4];

  useEffect(() => {
    return () => {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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
      setTimeout(() => {
        setMicTested(true);
        setIsTestingMic(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        stream.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      }, 2500);
    } catch (err: any) {
      console.error("Mic test error", err);
      setIsTestingMic(false);
      setMicError(
        err.name === "NotAllowedError"
          ? "Microphone permission denied in browser settings. Enable mic access or select Text mode."
          : "Could not access microphone. Text fallback is always available."
      );
    }
  }

  async function handleStartSession() {
    if (!selectedResumeId) {
      setErrorMsg("Please select a target job / resume.");
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
    } catch (err: any) {
      console.error("Start session error", err);
      setErrorMsg(err.message || "Failed to launch interview session");
      setIsStarting(false);
    }
  }

  if (isFreePlan) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <MicIcon className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-2xl font-display font-semibold text-ink">
          AI Mock Interview Prep is a Pro Feature
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-secondary leading-relaxed">
          Rehearse spoken Q&amp;A grounded strictly in your real logged evidence, practice honest missing-skill questions,
          and receive calibrated STAR and pacing feedback powered by Google Gemini.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button href="/upgrade" variant="primary" size="lg" className="rounded-pill">
            Upgrade to Pro to Rehearse &rarr;
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
          AI Interview Prep anchors questions to a target job description and your real tailored resume.
        </p>
        <div className="mt-6">
          <Button href="/resume/new" variant="primary" className="rounded-pill">
            Create Your First Resume &rarr;
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
          Rehearse it out loud before it counts.
        </h1>
        <p className="mt-3 text-[16.5px] leading-[1.6] text-ink-secondary max-w-[62ch]">
          Turn-based spoken practice calibrated honestly to your real evidence. Never fabricated &mdash; if you can&apos;t back a claim, the coach will make you rehearse saying so.
        </p>

        {linkedApplication && (
          <div className="mt-4 flex w-full items-center gap-3 rounded-lg border border-accent/40 bg-accent-soft/50 p-3.5">
            <span className="text-xl">🎯</span>
            <div className="flex flex-col">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                Rehearsing scheduled round
              </span>
              <span className="text-sm font-semibold text-ink">
                {linkedApplication.job_title} at {linkedApplication.company_name} &bull; {selectedStageOption.title}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_348px] gap-7 items-start">
        {/* Left Column: Numbered Steps */}
        <div className="flex flex-col gap-[22px]">
          {/* Step 1 — Target Job & Resume */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
                  1
                </div>
                <div>
                  <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
                    Target job &amp; resume
                  </h2>
                  <p className="text-[13px] text-ink-muted">
                    Questions and rubrics are calibrated strictly to this role and confirmed experience.
                  </p>
                </div>
              </div>
              {resumes.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChangingResume((prev) => !prev)}
                  className="text-xs rounded-pill"
                >
                  {isChangingResume ? "Done" : "Change"}
                </Button>
              )}
            </div>

            {/* Step 1 Active Card */}
            <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
                {/* Target Role & Employer */}
                <div className="min-w-[180px]">
                  <div className="font-semibold text-ink text-base leading-snug">
                    {selectedResume?.job_title || "Target Role"}
                  </div>
                  <div className="text-xs text-ink-secondary mt-0.5">
                    {selectedResume?.company_name || "Target Company"}
                  </div>
                </div>

                {/* Vertical Divider */}
                <div className="hidden sm:block h-9 w-px bg-border" />

                {/* Attached Resume */}
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-medium text-ink flex items-center gap-1.5">
                    <span>📄</span>
                    <span className="truncate">
                      {selectedResume?.job_title ? `${selectedResume.job_title} Resume` : "Primary Resume"}
                    </span>
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    Created {new Date(selectedResume?.created_at || Date.now()).toLocaleDateString("en-AU")}
                  </div>
                </div>

                {/* Grounding Badge (Single clean badge with full room for filename) */}
                <div className="flex items-center sm:ml-auto">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1 text-xs font-medium text-success">
                    <CheckIcon className="w-3.5 h-3.5" />
                    <span>Grounded in verified profile</span>
                  </span>
                </div>
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
                            "flex flex-col items-start rounded-lg border p-3 text-left transition-all text-xs",
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
          </section>

          {/* Step 2 — Interview Stage & Format */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
                2
              </div>
              <div>
                <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
                  Interview stage &amp; format
                </h2>
                <p className="text-[13px] text-ink-muted">
                  Each format sets the interviewer persona, question types, and evaluation criteria.
                </p>
              </div>
            </div>

            {/* 6 Format Cards Grid: 2-up breakpoint at 1180px */}
            <div
              role="radiogroup"
              aria-label="Interview stage and format"
              className="grid grid-cols-1 sm:grid-cols-2 min-[1180px]:grid-cols-3 gap-3.5 items-stretch"
            >
              {STAGES.map((s) => {
                const isSelected = s.type === selectedStage;
                return (
                  <div
                    key={s.type}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setSelectedStage(s.type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedStage(s.type);
                      }
                    }}
                    className={clsx(
                      "relative flex flex-col p-4 rounded-lg bg-surface border border-border cursor-pointer transition-all duration-fast select-none",
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

                    <div className="relative z-10 flex flex-col flex-1 justify-between gap-3">
                      <div>
                        {/* 1. Title + Tag */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-[15px] leading-[1.25] text-ink">
                            {s.title}
                          </span>
                          <Badge variant={s.badgeVariant} className="ml-auto shrink-0 text-[11px] px-2 py-0.5 rounded-pill">
                            {s.badge}
                          </Badge>
                        </div>

                        {/* 2. Description (tightened ~55-65 chars, fits 2 lines) */}
                        <p className="mt-2 text-[13px] leading-[1.45] text-ink-muted">
                          {s.description}
                        </p>
                      </div>

                      {/* 3. Meta Row pinned to bottom: Length · Question Count */}
                      <div className="text-[11.5px] font-medium text-ink-muted border-t border-border/50 pt-2">
                        {s.meta}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Step 3 — How You'll Answer */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
                3
              </div>
              <div>
                <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
                  How you&apos;ll answer
                </h2>
                <p className="text-[13px] text-ink-muted">
                  Select your answer method and coach evaluation pressure.
                </p>
              </div>
            </div>

            {/* Two Side-by-Side Control Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
              {/* Answer Mode Card */}
              <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                  ANSWER METHOD
                </span>
                <div className="inline-flex w-full rounded-pill bg-paper-deep p-1">
                  <button
                    type="button"
                    onClick={() => setMode("voice")}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-pill py-1.5 text-xs font-medium transition-colors",
                      mode === "voice"
                        ? "bg-accent text-on-accent font-semibold shadow-sm"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    <MicIcon className="w-3.5 h-3.5" />
                    <span>Spoken Voice</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("text")}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-pill py-1.5 text-xs font-medium transition-colors",
                      mode === "text"
                        ? "bg-accent text-on-accent font-semibold shadow-sm"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    <KeyboardIcon className="w-3.5 h-3.5" />
                    <span>Type Answer</span>
                  </button>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted mt-auto pt-1">
                  {mode === "voice"
                    ? "Spoken out loud with real-time AI audio processing and Gemini turn evaluation."
                    : "Type answers in STAR structure \u2014 ideal for quiet environments or draft practice."}
                </p>
              </div>

              {/* Interviewer Pressure Card */}
              <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3 shadow-sm">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent">
                  INTERVIEWER PRESSURE
                </span>
                <div className="inline-flex w-full rounded-pill bg-paper-deep p-1">
                  <button
                    type="button"
                    onClick={() => setPressure("supportive")}
                    className={clsx(
                      "flex-1 flex items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                      pressure === "supportive"
                        ? "bg-accent text-on-accent font-semibold shadow-sm"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    Supportive
                  </button>
                  <button
                    type="button"
                    onClick={() => setPressure("realistic")}
                    className={clsx(
                      "flex-1 flex items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                      pressure === "realistic"
                        ? "bg-accent text-on-accent font-semibold shadow-sm"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    Realistic
                  </button>
                  <button
                    type="button"
                    onClick={() => setPressure("tough")}
                    className={clsx(
                      "flex-1 flex items-center justify-center rounded-pill py-1.5 text-xs font-medium transition-colors",
                      pressure === "tough"
                        ? "bg-accent text-on-accent font-semibold shadow-sm"
                        : "text-ink-secondary hover:text-ink"
                    )}
                  >
                    Tough
                  </button>
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-muted mt-auto pt-1">
                  {pressure === "supportive"
                    ? "Encouraging tone, constructive nudges on missing STAR elements."
                    : pressure === "tough"
                    ? "Rigorous drilling \u2014 directly challenges vague metrics and probes flagged gaps."
                    : "Standard hiring manager calibration \u2014 probes claims and tests evidence."}
                </p>
              </div>
            </div>
          </section>

          {/* Step 4 — Audio & Privacy (Only rendered when mode is Voice) */}
          {mode === "voice" && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
                  4
                </div>
                <div>
                  <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
                    Audio &amp; privacy
                  </h2>
                  <p className="text-[13px] text-ink-muted">
                    Verify microphone input. Voice audio is never stored or retained.
                  </p>
                </div>
              </div>

              {/* Audio Card */}
              <div className="rounded-lg border border-border bg-surface p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Level Meter & Device Status */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="flex h-6 items-end gap-[3px]">
                    {[...Array(8)].map((_, i) => (
                      <span
                        key={i}
                        style={{
                          height: isTestingMic ? `${Math.max(6, Math.min(24, (micLevel * (0.4 + (i % 4) * 0.2))))}px` : "100%",
                          animationDelay: `${i * 0.12}s`,
                        }}
                        className={clsx(
                          "w-[5px] rounded-pill bg-success",
                          !isTestingMic && "audio-bar-pulse"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-ink">
                      {isTestingMic ? "Listening..." : micTested ? "✓ Levels look good" : "Microphone ready"}
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
                  <LockIcon className="w-4 h-4 shrink-0 text-ink-muted" />
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    Audio is processed by Google Gemini in real-time and immediately discarded. Never stored.
                  </p>
                </div>

                {/* Test Mic Button */}
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testMicrophone}
                    isLoading={isTestingMic}
                    className="text-xs rounded-pill"
                  >
                    {micTested ? "✓ Microphone Ready" : "Test Microphone"}
                  </Button>
                </div>
              </div>

              {micError && (
                <div className="rounded-lg bg-critical-soft p-3 text-xs text-critical">
                  {micError}
                </div>
              )}
            </section>
          )}

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
                YOUR SESSION
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
                <span className="text-ink-muted">Length</span>
                <span className="font-semibold text-ink">{selectedStageOption.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Questions</span>
                <span className="font-semibold text-ink">{selectedStageOption.questions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Answering</span>
                <span className="font-semibold text-ink">
                  {mode === "voice" ? "Spoken Voice (AI-evaluated)" : "Typed (STAR format)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Pressure</span>
                <span className="font-semibold capitalize text-ink">{pressure}</span>
              </div>
              <div className="border-t border-border/50 pt-2 flex flex-col gap-1">
                <span className="text-ink-muted">Scored on</span>
                <span className="font-medium text-ink leading-snug text-[11.5px]">
                  {selectedStageOption.scoredOn}
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
              Begin mock interview &rarr;
            </Button>

            {/* Reassurance copy */}
            <p className="text-center text-[12px] text-ink-muted leading-relaxed">
              Pause or end at any point. Scorecard saved either way.
            </p>
          </div>

          {/* 2. Grounding Card */}
          <div className="rounded-lg bg-success-soft border border-success/20 p-5 flex flex-col gap-2 shadow-sm">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-success">
              GROUNDED IN YOUR EVIDENCE
            </span>
            <p className="text-[13px] leading-relaxed text-ink-secondary font-normal">
              Every question is anchored strictly to your target job ad and verified career history. The coach never hallucinates experience or asks generic trivia.
            </p>
            <div className="mt-1 text-[12px] font-medium text-success flex items-center gap-1">
              <span>Questions drill real duties and honest gap navigation &rarr;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
