import type { PressureLevel } from "@/lib/interview/setupConstants";

/** Appended to both the question writer (lib/gemini/generateInterviewQuestions.ts) and the scorer
 *  (lib/gemini/scoreInterviewAnswer.ts). Realistic is the default behaviour, so it adds nothing. */
export const TONE_PROMPT_FRAGMENTS: Record<PressureLevel, string> = {
  supportive:
    "Ask one-part questions in plain language. In feedback, start with one specific thing that worked, then give exactly one improvement. Warm, encouraging wording.",
  realistic: "",
  tough:
    "Ask multi-part questions that probe trade-offs, failures and decisions. Prefer follow-ups whenever an action is vague or an outcome is missing. In feedback, start with where points were lost. Be direct and specific, never rude or personal.",
};
