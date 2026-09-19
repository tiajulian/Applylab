"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeResume, snapshotBlocks } from "@/lib/review/analyze";
import { listBlocks } from "@/lib/review/blocks";
import { loadReviewState, reviewStorageKey, saveReviewState, type PersistedReviewState } from "@/lib/review/dismissals";
import type { ProfileSource } from "@/lib/review/provenance";
import type { ReviewItem, ReviewStatus } from "@/lib/review/types";
import { getSpellChecker } from "@/lib/text/spellcheck";
import type { FactCheckFlag, ResumeContent } from "@/types";

/** Typing has to settle this long before the resume is re-analysed. */
export const REVIEW_DEBOUNCE_MS = 1500;

export type ReviewPhase = "idle" | "checking" | "ready";

/**
 * Owns the single list of review items that the chip, the panel and the preview highlights all read.
 * Re-analyses (changed blocks only) 1.5s after the last edit, immediately after an action, and in full
 * when the window regains focus (another tab may have changed the dismissals).
 */
export function useReviewItems({
  resumeId,
  content,
  profile,
  flags,
}: {
  resumeId: string;
  content: ResumeContent;
  profile: ProfileSource | null;
  flags: FactCheckFlag[];
}) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [phase, setPhase] = useState<ReviewPhase>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const itemsRef = useRef<ReviewItem[]>([]);
  const previousRef = useRef<Map<string, string> | null>(null);
  const stateRef = useRef<PersistedReviewState | null>(null);
  const getState = () => (stateRef.current ??= loadReviewState(resumeId));
  const nextDelayRef = useRef(REVIEW_DEBOUNCE_MS);
  const lastCtxRef = useRef<{ profile: unknown; flags: unknown; checker: unknown }>({ profile: null, flags: null, checker: null });

  const commitItems = useCallback((next: ReviewItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("checking");
    const timer = setTimeout(async () => {
      const checker = await getSpellChecker().catch(() => null);
      if (cancelled) return;
      const last = lastCtxRef.current;
      const contextChanged = last.profile !== profile || last.flags !== flags || last.checker !== checker;
      lastCtxRef.current = { profile, flags, checker };
      const next = analyzeResume({
        resumeId, content, prev: itemsRef.current, previous: contextChanged ? null : previousRef.current,
        ctx: { checker, profile, flags }, dismissed: getState().dismissed, kept: getState().kept,
      });
      previousRef.current = snapshotBlocks(listBlocks(content));
      commitItems(next);
      setSelectedId((id) => (id && next.some((i) => i.id === id && i.status !== "resolved") ? id : null));
      setPhase("ready");
    }, nextDelayRef.current);
    nextDelayRef.current = REVIEW_DEBOUNCE_MS;
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resumeId, content, profile, flags, refreshTick, commitItems]);

  /** Re-check without the debounce - for the edit an action (or undo/redo) is about to make. */
  const analyzeSoon = useCallback(() => {
    nextDelayRef.current = 0;
  }, []);

  // Another tab may have dismissed/accepted items, or edited the resume: re-read the shared decisions
  // and re-check everything when this tab is focused again. The selected card stays selected (ids are stable).
  useEffect(() => {
    const refresh = () => {
      stateRef.current = loadReviewState(resumeId);
      previousRef.current = null;
      nextDelayRef.current = 0;
      setRefreshTick((n) => n + 1);
    };
    const onStorage = (e: StorageEvent) => e.key === reviewStorageKey(resumeId) && refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [resumeId]);

  const setStatus = useCallback(
    (ids: string[], status: ReviewStatus) => {
      const target = new Set(ids);
      const state = (stateRef.current ??= loadReviewState(resumeId));
      for (const id of ids) {
        state.dismissed.delete(id);
        state.kept.delete(id);
        if (status === "dismissed") state.dismissed.add(id);
        if (status === "accepted") state.kept.add(id);
      }
      saveReviewState(resumeId, state);
      commitItems(itemsRef.current.map((i) => (target.has(i.id) ? { ...i, status } : i)));
    },
    [resumeId, commitItems]
  );

  return { items, phase, selectedId, select: setSelectedId, setStatus, analyzeSoon };
}
