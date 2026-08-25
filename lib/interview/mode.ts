import type { InterviewMode, InterviewStageType } from "@/types";

/**
 * 'group' is the only stage a 1:1 voice AI cannot honestly simulate (it can't observe multi-party
 * dynamics like airtime-sharing or interrupting) - see components/interview/GroupCoachingView.tsx.
 * Every other stage runs the normal scored Q&A simulation.
 */
export function stageToMode(stageType: InterviewStageType): InterviewMode {
  return stageType === "group" ? "coaching" : "simulation";
}
