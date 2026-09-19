/** Per-resume review decisions that survive a reload. Browser-local by design (localStorage), so they
 * follow this browser, not the account. Every access is guarded: storage can be blocked or full. */
export interface PersistedReviewState {
  /** Item ids the user dismissed. */
  dismissed: Set<string>;
  /** Item ids of Changes the user accepted as-is (no edit made them stop matching). */
  kept: Set<string>;
}

export const reviewStorageKey = (resumeId: string) => `applylab:review:${resumeId}`;

export function loadReviewState(resumeId: string): PersistedReviewState {
  try {
    const parsed = JSON.parse(localStorage.getItem(reviewStorageKey(resumeId)) ?? "{}");
    const ids = (value: unknown) => new Set<string>(Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);
    return { dismissed: ids(parsed.dismissed), kept: ids(parsed.kept) };
  } catch {
    return { dismissed: new Set(), kept: new Set() };
  }
}

export function saveReviewState(resumeId: string, state: PersistedReviewState): void {
  try {
    localStorage.setItem(
      reviewStorageKey(resumeId),
      JSON.stringify({ dismissed: [...state.dismissed], kept: [...state.kept] })
    );
  } catch {
    // Storage unavailable: decisions last for this session only.
  }
}
