import type { InterviewStageType } from "@/types";

/** Main questions per session. The card, the rail and the question writer all read this, so
 *  what the setup page promises is what the session asks. Follow-ups are extra (see
 *  followUpAllowance in lib/interview/followup.ts) and never count toward it. */
export const STAGE_QUESTION_COUNT: Record<InterviewStageType, number> = {
  general: 8,
  phone_screen: 6,
  panel: 10,
  technical: 8,
  coding: 4,
  async_video: 5,
  group: 4,
};

/** Rough minutes per main question including feedback, used only for the "about N min" estimate
 *  until real session durations exist (USE_MEASURED_DURATIONS). */
export const MINUTES_PER_QUESTION: Record<InterviewStageType, number> = {
  general: 3,
  phone_screen: 2.5,
  panel: 3.5,
  technical: 3.5,
  coding: 7,
  async_video: 3,
  group: 4,
};

/** Switch to the p50 of real finished sessions per type once there is enough data. */
export const USE_MEASURED_DURATIONS = false;

/** Rounded to 5 minutes so the estimate never looks more precise than it is. */
export function estimateMinutes(type: InterviewStageType, questionCount = STAGE_QUESTION_COUNT[type]): number {
  return Math.max(5, Math.round((questionCount * MINUTES_PER_QUESTION[type]) / 5) * 5);
}

/** Recorded video mirrors real one-way screens: prep countdown, fixed answer window, one re-take. */
export const VIDEO_PREP_SEC = 30;
export const VIDEO_ANSWER_SEC = 120;
export const VIDEO_RETAKES = 1;
/** Every other type counts up; past this the timer turns amber with a wrap-up hint. */
export const SOFT_ANSWER_GUIDE_SEC = 150;

export interface StageOption {
  type: InterviewStageType;
  title: string;
  badge?: string;
  badgeVariant?: "accent" | "neutral" | "attention" | "success";
  description: string;
  questionCount: number;
  minutes: number;
  /** "8 questions" (or "4 practice prompts" for the coached group walkthrough). */
  questions: string;
  /** "about 25 min" */
  length: string;
  /** "8 questions · about 25 min" */
  meta: string;
  persona: string;
  feedbackOn: string;
}

function stage(
  option: Omit<StageOption, "questionCount" | "minutes" | "questions" | "length" | "meta">
): StageOption {
  const questionCount = STAGE_QUESTION_COUNT[option.type];
  const minutes = estimateMinutes(option.type);
  const questions = option.type === "group" ? `${questionCount} practice prompts` : `${questionCount} questions`;
  const length = `about ${minutes} min`;
  return { ...option, questionCount, minutes, questions, length, meta: `${questions} · ${length}` };
}

export const STAGES: StageOption[] = [
  stage({
    type: "general",
    title: "Standard interview",
    badge: "Most popular",
    badgeVariant: "accent",
    description: "Common questions about your experience, how you work and what you achieved.",
    persona: "Hiring manager and team lead",
    feedbackOn: "Clear examples, delivery and impact",
  }),
  stage({
    type: "phone_screen",
    title: "First phone call",
    description: "A short call about your background, why you want the job and what you expect.",
    persona: "Recruiter or talent specialist",
    feedbackOn: "Role fit, background summary and motivation",
  }),
  stage({
    type: "panel",
    title: "Panel of interviewers",
    description: "Several interviewers, each asking from a different angle.",
    persona: "Cross-functional team and hiring lead",
    feedbackOn: "Teamwork, stakeholder communication and breadth",
  }),
  stage({
    type: "technical",
    title: "Skills and know-how",
    description: "Questions on the tools, systems and problems you have really worked with.",
    persona: "Senior technical lead",
    feedbackOn: "Problem solving, tools and practical trade-offs",
  }),
  stage({
    type: "coding",
    title: "Coding round",
    description: "Algorithm and problem-solving prompts, coached like a real coding screen.",
    persona: "Senior engineer",
    feedbackOn: "Approach, correctness and complexity trade-offs",
  }),
  stage({
    type: "async_video",
    title: "Recorded video",
    description: "On-screen questions with 30 seconds to prepare and 2 minutes to answer.",
    persona: "Automated video assessment",
    feedbackOn: "Concise answers, pace and structure under time limits",
  }),
  stage({
    type: "group",
    title: "Group assessment day",
    badge: "Advice only",
    badgeVariant: "attention",
    description: "Tips and practice for group activities and discussions.",
    persona: "Assessment day coach",
    feedbackOn: "Discussion leadership, teamwork and problem solving",
  }),
];

/** The free plan's practice: one short Standard session, lifetime. Change
 *  `period` (with the server check in lib/interview/allowance.ts) to go monthly later. */
export const FREE_INTERVIEW_ALLOWANCE = {
  count: 1,
  period: "lifetime" as const,
  questionCount: 3,
  stageType: "general" as InterviewStageType,
};

/** Shown up front; the rest sit behind "More interview types". */
export const PRIMARY_STAGE_TYPES: InterviewStageType[] = ["general", "phone_screen", "panel"];

export type AnswerMode = "voice" | "text";

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
