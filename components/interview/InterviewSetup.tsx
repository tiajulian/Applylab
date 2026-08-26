"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { clsx } from "@/lib/utils";
import type { InterviewStageType, Resume, AppUser } from "@/types";

export interface InterviewSetupProps {
  resumes: Resume[];
  user: AppUser;
}

interface StageOption {
  type: InterviewStageType;
  title: string;
  badge: string;
  badgeVariant: "accent" | "neutral" | "attention" | "success";
  description: string;
  focus: string;
}

const STAGES: StageOption[] = [
  {
    type: "phone_screen",
    title: "Phone Screen",
    badge: "Simulated",
    badgeVariant: "accent",
    description: "Short, high-level screening probing motivation, career background, and cultural fit.",
    focus: "Role fit, concise storytelling, clarity",
  },
  {
    type: "technical",
    title: "Technical & Practical",
    badge: "Simulated",
    badgeVariant: "accent",
    description: "Deep dive into real systems, architecture decisions, and includes an honest missing-skill gap question.",
    focus: "Technical depth, problem solving, honest gap handling",
  },
  {
    type: "panel",
    title: "Panel Interview",
    badge: "Multi-Persona",
    badgeVariant: "neutral",
    description: "Simulates multiple interviewers (e.g. Hiring Manager, Technical Lead, Product Lead) rotating competencies.",
    focus: "STAR breadth, addressing multiple stakeholders",
  },
  {
    type: "async_video",
    title: "Async Video Interview",
    badge: "One-Way",
    badgeVariant: "neutral",
    description: "Simulates one-way video prompts (e.g. HireVue/Spark Hire) with strict 2-minute answer ceilings.",
    focus: "Pacing, immediate structure, concise impact",
  },
  {
    type: "group",
    title: "Group Assessment Centre",
    badge: "Coached (Not Simulated)",
    badgeVariant: "attention",
    description: "Dedicated coaching on assessment centre dynamics, assessor rubrics, and contribution playbooks.",
    focus: "Active listening, collaborative consensus, synthesis",
  },
  {
    type: "general",
    title: "General Behavioural",
    badge: "Simulated",
    badgeVariant: "success",
    description: "Balanced, high-yield behavioural question set covering core leadership and delivery competencies.",
    focus: "Classic STAR execution, measurable results",
  },
];

export function InterviewSetup({ resumes, user }: InterviewSetupProps) {
  const router = useRouter();
  const [selectedResumeId, setSelectedResumeId] = useState<string>(
    resumes.length > 0 ? resumes[0].id : ""
  );
  const [selectedStage, setSelectedStage] = useState<InterviewStageType>("general");
  const [isStarting, setIsStarting] = useState(false);
  const [micTested, setMicTested] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isFreePlan = user.plan === "free";

  async function testMicrophone() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicTested(true);
      stream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      console.error("Mic test error", err);
      setMicError(
        err.name === "NotAllowedError"
          ? "Microphone permission denied in browser settings."
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl">
          🎙️
        </div>
        <h2 className="mt-4 text-2xl font-display font-semibold text-ink">
          AI Mock Interview Prep is a Pro Feature
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-secondary leading-relaxed">
          Rehearse spoken Q&A grounded strictly in your real logged evidence, practice honest missing-skill questions,
          and receive calibrated STAR and pacing feedback powered by Google Gemini.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/upgrade">
            <Button variant="primary" size="lg">
              Upgrade to Pro to Rehearse →
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary" size="lg">
              Return to Dashboard
            </Button>
          </Link>
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
          <Link href="/resume/new">
            <Button variant="primary">Create Your First Resume →</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-ink">
          Voice AI Interview Preparation
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Turn-based spoken practice calibrated honestly to your real evidence. Never fabricated.
        </p>
      </div>

      {/* 1. Target Resume / Job Selector */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink">1. Select Target Job & Resume</h2>
        <p className="text-xs text-ink-muted">
          Questions and coaching will be grounded strictly in this role&apos;s requirements and your confirmed experience.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {resumes.map((r) => {
            const isSelected = r.id === selectedResumeId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedResumeId(r.id)}
                className={clsx(
                  "flex flex-col items-start rounded-lg border p-4 text-left transition-all",
                  isSelected
                    ? "border-accent bg-accent-soft/20 shadow-sm"
                    : "border-border bg-paper hover:border-border-strong hover:bg-paper-deep"
                )}
              >
                <span className="font-semibold text-ink">
                  {r.job_title || "Untitled Role"}
                </span>
                <span className="text-xs text-ink-secondary">
                  {r.company_name || "Company"}
                </span>
                <span className="mt-2 text-[11px] text-ink-muted">
                  Created {new Date(r.created_at).toLocaleDateString("en-AU")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Stage Picker */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-base font-semibold text-ink">2. Choose Interview Stage & Format</h2>
        <p className="text-xs text-ink-muted">
          Each option calibrates the question blend, interviewer persona, and feedback rubric.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((s) => {
            const isSelected = s.type === selectedStage;
            return (
              <button
                key={s.type}
                type="button"
                onClick={() => setSelectedStage(s.type)}
                className={clsx(
                  "flex flex-col items-start rounded-lg border p-4 text-left transition-all",
                  isSelected
                    ? "border-accent bg-accent-soft/20 shadow-sm"
                    : "border-border bg-paper hover:border-border-strong hover:bg-paper-deep"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-ink text-sm">{s.title}</span>
                  <Badge variant={s.badgeVariant}>{s.badge}</Badge>
                </div>
                <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
                  {s.description}
                </p>
                <div className="mt-3 text-[11px] text-ink-muted">
                  <strong>Focus:</strong> {s.focus}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Audio & Privacy Check */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">3. Audio Readiness & Privacy</h2>
            <p className="text-xs text-ink-secondary">
              🔒 Audio is processed by Google Gemini in real-time and immediately discarded. Never stored.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={testMicrophone}
            >
              {micTested ? "✓ Microphone Ready" : "Test Microphone"}
            </Button>
          </div>
        </div>

        {micError && (
          <div className="mt-3 rounded bg-critical-soft p-2.5 text-xs text-critical">
            {micError}
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="rounded bg-critical-soft p-4 text-sm text-critical">
          {errorMsg}
        </div>
      )}

      {/* Submit Action */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={handleStartSession}
          isLoading={isStarting}
          disabled={!selectedResumeId}
          className="w-full sm:w-auto"
        >
          Begin Mock Interview →
        </Button>
      </div>
    </div>
  );
}
