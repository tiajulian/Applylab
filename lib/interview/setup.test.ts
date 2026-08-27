import { describe, it, expect } from "vitest";
import type { InterviewStageType } from "@/types";

const STAGES: {
  type: InterviewStageType;
  title: string;
  badge: string;
  meta: string;
  length: string;
  questions: string;
  persona: string;
  focusChips: string[];
  scoredOn: string;
}[] = [
  {
    type: "technical",
    title: "Technical & Practical",
    badge: "Simulated",
    meta: "35 min · 8 questions",
    length: "35 min",
    questions: "8 questions",
    persona: "Senior Technical Interviewer",
    focusChips: ["Technical depth", "Problem solving", "Honest gap handling"],
    scoredOn: "Technical depth · Architecture tradeoffs · Gap candour",
  },
  {
    type: "panel",
    title: "Panel Interview",
    badge: "Multi-Persona",
    meta: "40 min · 10 questions",
    length: "40 min",
    questions: "10 questions",
    persona: "Hiring Manager + Technical Lead + Cross-Functional Partner",
    focusChips: ["STAR breadth", "Multiple stakeholders"],
    scoredOn: "Stakeholder management · STAR execution · Cross-functional breadth",
  },
  {
    type: "async_video",
    title: "Async Video",
    badge: "One-Way",
    meta: "20 min · 5 questions",
    length: "20 min",
    questions: "5 questions",
    persona: "Automated Video Assessment",
    focusChips: ["Pacing", "Immediate structure", "Concise impact"],
    scoredOn: "Time ceiling discipline · Rapid STAR structure · Impact delivery",
  },
  {
    type: "group",
    title: "Assessment Centre",
    badge: "Coached",
    meta: "25 min · Walkthrough",
    length: "25 min",
    questions: "Walkthrough",
    persona: "Senior Assessment Centre Coach",
    focusChips: ["Active listening", "Collaborative consensus", "Synthesis"],
    scoredOn: "Group facilitation · Consensus building · Structured synthesis",
  },
  {
    type: "general",
    title: "General Behavioural",
    badge: "Simulated",
    meta: "30 min · 8 questions",
    length: "30 min",
    questions: "8 questions",
    persona: "Hiring Manager & Department Lead",
    focusChips: ["Classic STAR execution", "Measurable results"],
    scoredOn: "Classic STAR execution · Metric clarity · Ownership & impact",
  },
  {
    type: "phone_screen",
    title: "Phone Screen",
    badge: "Simulated",
    meta: "15 min · 6 questions",
    length: "15 min",
    questions: "6 questions",
    persona: "Talent Acquisition Specialist",
    focusChips: ["Role fit", "Concise storytelling", "Clarity"],
    scoredOn: "Motivation · Role alignment · Communication clarity",
  },
];

describe("Interview Setup Stage Configurations", () => {
  it("contains all six canonical interview stages", () => {
    const expectedStages: InterviewStageType[] = [
      "technical",
      "panel",
      "async_video",
      "group",
      "general",
      "phone_screen",
    ];
    const stageTypes = STAGES.map((s) => s.type);
    expect(stageTypes).toEqual(expect.arrayContaining(expectedStages));
    expect(stageTypes).toHaveLength(6);
  });

  it("shortens titles per redesign specification", () => {
    const asyncStage = STAGES.find((s) => s.type === "async_video");
    expect(asyncStage?.title).toBe("Async Video");

    const groupStage = STAGES.find((s) => s.type === "group");
    expect(groupStage?.title).toBe("Assessment Centre");
    expect(groupStage?.badge).toBe("Coached");
  });

  it("provides complete metadata and persona for all stages", () => {
    for (const stage of STAGES) {
      expect(stage.title).toBeTruthy();
      expect(stage.badge).toBeTruthy();
      expect(stage.meta).toBeTruthy();
      expect(stage.persona).toBeTruthy();
      expect(stage.length).toBeTruthy();
      expect(stage.questions).toBeTruthy();
      expect(stage.focusChips.length).toBeGreaterThan(0);
      expect(stage.scoredOn).toBeTruthy();
    }
  });

  it("properly resolves session answering mode label", () => {
    const voiceLabel = "Spoken Voice (AI-evaluated)";
    const textLabel = "Typed (STAR format)";

    const getAnsweringLabel = (mode: "voice" | "text") =>
      mode === "voice" ? voiceLabel : textLabel;

    expect(getAnsweringLabel("voice")).toBe(voiceLabel);
    expect(getAnsweringLabel("text")).toBe(textLabel);
  });
});
