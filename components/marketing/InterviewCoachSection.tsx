"use client";

import { useState } from "react";
import { Container } from "@/components/marketing/Container";
import { Reveal } from "@/components/ui/Reveal";

interface StageTab {
  id: string;
  name: string;
  badge: string;
  question: string;
  candidateAnswer: string;
  score: number;
  starBreakdown: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  feedback: string;
}

const INTERVIEW_STAGES: StageTab[] = [
  {
    id: "phone_screen",
    name: "Phone Screen",
    badge: "Recruiter Screen",
    question: "Why are you looking to transition from retail shift supervision into operations coordination?",
    candidateAnswer: "Over the last 3 years I realised my strongest value is building systems that keep floor teams running smoothly. I redesigned our stockroom inventory flow and managed daily financial reconciliations, and I want to bring that operational discipline to Metro Logistics full time.",
    score: 90,
    starBreakdown: {
      situation: "Clear motivation rooted in real experience",
      task: "Identified personal strengths accurately",
      action: "Referenced tangible workflow achievements",
      result: "Natural bridge to target role requirements",
    },
    feedback: "High clarity and strong tone. You connected past duties directly to their operational scope without sounding defensive.",
  },
  {
    id: "behavioural",
    name: "Behavioural (STAR)",
    badge: "STAR Scorecard",
    question: "Tell me about a time you resolved a difficult operational bottleneck under pressure.",
    candidateAnswer: "During peak holiday trade, floor restocking was causing 40-minute register delays. As shift supervisor, I restructured the inventory classification system into high-frequency zones. This reduced staff retrieval times by 35% and eliminated customer checkout backlog entirely.",
    score: 92,
    starBreakdown: {
      situation: "Holiday retail rush with 40-min checkout delays",
      task: "Needed to speed up stock replenishment immediately",
      action: "Reclassified stockroom into high-velocity zones",
      result: "35% faster retrieval, zero checkout backlog",
    },
    feedback: "Exceptional STAR structure with quantified outcomes. Directly maps to Metro Logistics' logistics coordination needs.",
  },
  {
    id: "technical",
    name: "Technical & Practical",
    badge: "Gap Handling",
    question: "How do you approach reporting when you encounter a tool you haven't used extensively, such as Power BI?",
    candidateAnswer: "While I haven't deployed Power BI in production yet, I manage daily financial reconciliations in Excel with advanced lookup formulas. I understand relational data modeling and typically master new dashboard tools within my first two weeks.",
    score: 86,
    starBreakdown: {
      situation: "Acknowledged missing tool transparently",
      task: "Bridged to adjacent spreadsheet competencies",
      action: "Explained fast self-directed learning approach",
      result: "Maintained credibility without faking expertise",
    },
    feedback: "Honest gap handling is highly respected by Australian hiring managers. You avoided bluffing and demonstrated immediate learning capability.",
  },
  {
    id: "panel",
    name: "Panel Interview",
    badge: "Multi-Stakeholder",
    question: "How do you manage disagreements between warehouse dispatchers and commercial account managers?",
    candidateAnswer: "I establish single-source metrics so both teams view the same data. In my previous role, when sales promised rush orders that strained floor capacity, I instituted a 15-minute daily sync to agree on dispatch priorities collaboratively.",
    score: 88,
    starBreakdown: {
      situation: "Competing commercial vs operational priorities",
      task: "Establish objective ground rules between parties",
      action: "Instituted daily alignment standup meetings",
      result: "Reduced conflict and improved on-time dispatch",
    },
    feedback: "Strong multi-stakeholder awareness. Balanced commercial reality with team workload capacity.",
  },
];

export function InterviewCoachSection() {
  const [activeStageId, setActiveStageId] = useState<string>("behavioural");

  const activeStage = INTERVIEW_STAGES.find((s) => s.id === activeStageId) || INTERVIEW_STAGES[1];

  return (
    <section id="interview-coach" className="scroll-mt-24 border-t border-border bg-paper-deep/60 py-20">
      <Container size="6xl">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-meta font-semibold uppercase tracking-wider text-accent">
              Pillar 6 &middot; AI Interview Coach
            </span>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Walk into every interview already knowing the answers.
            </h2>
            <p className="mt-4 text-base text-ink-secondary sm:text-lg">
              Practice role-specific interview questions using your voice or text. Get real-time STAR scoring, honest missing-skill gap coaching, and turn-by-turn feedback before meeting the recruiter.
            </p>
          </Reveal>
        </div>

        {/* Stage Selector Tabs */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {INTERVIEW_STAGES.map((stage) => {
            const isActive = stage.id === activeStageId;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStageId(stage.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-accent text-on-accent shadow-sm scale-105"
                    : "border border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-ink"
                }`}
              >
                <span>{stage.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive ? "bg-surface/20 text-on-accent" : "bg-paper-deep text-ink-muted"
                  }`}
                >
                  {stage.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Interview Turn & STAR Scorecard Card */}
        <div className="mt-8 mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-pop">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                🎙️ {activeStage.name} Simulation &middot; Turn 1 of 5
              </span>
              <h3 className="mt-1 font-display text-base sm:text-lg font-bold text-ink">
                &ldquo;{activeStage.question}&rdquo;
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success border border-success/30">
                Score: {activeStage.score}/100
              </span>
            </div>
          </div>

          {/* Candidate Answer Box */}
          <div className="mt-5 rounded-xl border border-border bg-paper p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
              <span>Your Spoken / Text Response:</span>
              <span className="text-accent font-bold">🎙️ Transcribed via Audio</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-ink leading-relaxed italic">
              &ldquo;{activeStage.candidateAnswer}&rdquo;
            </p>
          </div>

          {/* STAR Scorecard Evaluation */}
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
              Turn-by-Turn STAR Scorecard:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-paper-deep/50 p-3">
                <span className="text-[11px] font-bold text-accent">Situation</span>
                <p className="mt-1 text-xs text-ink">{activeStage.starBreakdown.situation}</p>
              </div>
              <div className="rounded-lg border border-border bg-paper-deep/50 p-3">
                <span className="text-[11px] font-bold text-accent">Task</span>
                <p className="mt-1 text-xs text-ink">{activeStage.starBreakdown.task}</p>
              </div>
              <div className="rounded-lg border border-border bg-paper-deep/50 p-3">
                <span className="text-[11px] font-bold text-accent">Action</span>
                <p className="mt-1 text-xs text-ink">{activeStage.starBreakdown.action}</p>
              </div>
              <div className="rounded-lg border border-border bg-paper-deep/50 p-3">
                <span className="text-[11px] font-bold text-success">Result</span>
                <p className="mt-1 text-xs text-ink">{activeStage.starBreakdown.result}</p>
              </div>
            </div>
          </div>

          {/* Coach Feedback Box */}
          <div className="mt-5 rounded-xl border border-accent/25 bg-accent-soft/35 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-accent">
              <span>💡 Coach Analysis &amp; Recommendation:</span>
            </div>
            <p className="mt-1.5 text-xs text-ink leading-relaxed">
              {activeStage.feedback}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
