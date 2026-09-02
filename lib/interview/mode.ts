import type { InterviewMode, InterviewStageType } from "@/types";

/**
 * 'group' and 'coding' are the stages a 1:1 voice AI cannot honestly score with the STAR rubric:
 * 'group' can't observe multi-party dynamics like airtime-sharing or interrupting (see
 * components/interview/GroupCoachingView.tsx), and 'coding' is graded by an LLM reading the
 * submitted code rather than executing it, so there's no real pass/fail signal to report as a
 * numeric score. Every other stage runs the normal scored Q&A simulation.
 */
export function stageToMode(stageType: InterviewStageType): InterviewMode {
  return stageType === "group" || stageType === "coding" ? "coaching" : "simulation";
}
