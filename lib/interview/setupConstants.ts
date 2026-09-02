import type { InterviewStageType } from "@/types";

export interface StageOption {
  type: InterviewStageType;
  title: string;
  badge?: string;
  badgeVariant?: "accent" | "neutral" | "attention" | "success";
  description: string;
  meta: string;
  length: string;
  questions: string;
  persona: string;
  feedbackOn: string;
}

export const STAGES: StageOption[] = [
  {
    type: "general",
    title: "Standard interview",
    badge: "Most popular",
    badgeVariant: "accent",
    description: "High-yield questions on your experience, delivery and wins.",
    meta: "30 min · 8 questions",
    length: "30 min",
    questions: "8 questions",
    persona: "Hiring manager and team lead",
    feedbackOn: "Clear examples, delivery and impact",
  },
  {
    type: "phone_screen",
    title: "First phone call",
    description: "Quick check on your background, motivation and expectations.",
    meta: "15 min · 6 questions",
    length: "15 min",
    questions: "6 questions",
    persona: "Recruiter or talent specialist",
    feedbackOn: "Role fit, background summary and motivation",
  },
  {
    type: "panel",
    title: "Panel of interviewers",
    description: "Questions from multiple team members across different angles.",
    meta: "40 min · 10 questions",
    length: "40 min",
    questions: "10 questions",
    persona: "Cross-functional team and hiring lead",
    feedbackOn: "Teamwork, stakeholder communication and breadth",
  },
  {
    type: "technical",
    title: "Skills and know-how",
    description: "Deep dive into real systems, tools and problem solving.",
    meta: "35 min · 8 questions",
    length: "35 min",
    questions: "8 questions",
    persona: "Senior technical lead",
    feedbackOn: "Problem solving, tools and practical tradeoffs",
  },
  {
    type: "coding",
    title: "Coding round",
    description: "Algorithm and problem-solving prompts, coached like a real coding screen.",
    meta: "30 min · 4 questions",
    length: "30 min",
    questions: "4 questions",
    persona: "Senior engineer",
    feedbackOn: "Approach, correctness and complexity tradeoffs",
  },
  {
    type: "async_video",
    title: "Recorded video",
    description: "One-way video prompts with a strict two-minute answer limit.",
    meta: "20 min · 5 questions",
    length: "20 min",
    questions: "5 questions",
    persona: "Automated video assessment",
    feedbackOn: "Concise answers, pace and structure under time limits",
  },
  {
    type: "group",
    title: "Group assessment day",
    badge: "Advice only",
    badgeVariant: "attention",
    description: "Tips and strategies for group activities and discussions.",
    meta: "25 min · Walkthrough",
    length: "25 min",
    questions: "Walkthrough",
    persona: "Assessment day coach",
    feedbackOn: "Discussion leadership, teamwork and problem solving",
  },
];

export type AnswerMode = "voice" | "text";
export type PressureLevel = "supportive" | "realistic" | "tough";

export interface AnswerModeOption {
  mode: AnswerMode;
  title: string;
  badge?: string;
  description: string;
  railLabel: string;
}

export const ANSWER_MODES: Record<AnswerMode, AnswerModeOption> = {
  voice: {
    mode: "voice",
    title: "Out loud",
    badge: "Recommended",
    description: "Closest to the real thing, and tracks your pace and filler words.",
    railLabel: "Out loud (AI feedback)",
  },
  text: {
    mode: "text",
    title: "Typed",
    description: "Take as long as you like, ideal for quiet spaces or drafting.",
    railLabel: "Typed (take your time)",
  },
};

export interface PressureOption {
  level: PressureLevel;
  label: string;
  hint: string;
}

export const PRESSURE_OPTIONS: Record<PressureLevel, PressureOption> = {
  supportive: {
    level: "supportive",
    label: "Gentle",
    hint: "Encouraging tone with helpful nudges if you get stuck.",
  },
  realistic: {
    level: "realistic",
    label: "Normal",
    hint: "Standard hiring manager style with realistic follow-up questions.",
  },
  tough: {
    level: "tough",
    label: "Tough",
    hint: "Direct drilling that challenges vague answers and probes gaps.",
  },
};

export interface QuestionDisplayOption {
  hide: boolean;
  label: string;
  shortLabel: string;
  hint: string;
}

export const QUESTION_DISPLAY_OPTIONS: Record<"show" | "hear", QuestionDisplayOption> = {
  show: {
    hide: false,
    label: "Show on screen",
    shortLabel: "Questions on screen",
    hint: "Question text is shown on screen alongside the audio.",
  },
  hear: {
    hide: true,
    label: "Hear only",
    shortLabel: "Hear only",
    hint: "Questions are read aloud only, just like a real interview.",
  },
};

export function resolveStage(
  stageParam?: string,
  interviewStage?: string
): InterviewStageType {
  const raw = (interviewStage || stageParam || "").toLowerCase();
  if (raw === "phone_screen" || raw === "screening") return "phone_screen";
  if (raw === "technical") return "technical";
  if (raw === "coding") return "coding";
  if (raw === "panel") return "panel";
  if (raw === "async_video") return "async_video";
  if (raw === "group" || raw === "assessment_centre") return "group";
  return "general";
}
