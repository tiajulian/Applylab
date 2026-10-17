import type { AnswerMode } from "@/lib/interview/setupConstants";

const STORAGE_KEY = "applylab:interview:hideQuestionText";
const ANSWER_MODE_KEY = "applylab:interview:answerMode";

/** Whether the candidate has opted to hide question captions by default (audio-only, closer
 *  to a real interview). Persisted per-browser so it carries across future sessions too. */
export function getHideQuestionTextPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHideQuestionTextPreference(hide: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, hide ? "1" : "0");
  } catch {
    // Private browsing / storage disabled - preference just won't persist, not worth surfacing.
  }
}

/** "How do you want to answer?" from the setup page, read by the session's answer box so the
 *  choice actually carries into the interview. Defaults to out loud. */
export function getAnswerModePreference(): AnswerMode {
  if (typeof window === "undefined") return "voice";
  try {
    return localStorage.getItem(ANSWER_MODE_KEY) === "text" ? "text" : "voice";
  } catch {
    return "voice";
  }
}

export function setAnswerModePreference(mode: AnswerMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANSWER_MODE_KEY, mode);
  } catch {
    // Same as above: the session just falls back to out loud.
  }
}
