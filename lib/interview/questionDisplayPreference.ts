const STORAGE_KEY = "applylab:interview:hideQuestionText";

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
