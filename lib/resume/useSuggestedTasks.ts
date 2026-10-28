"use client";

import { useEffect, useRef, useState } from "react";
import { fetchSuggestions, lookupSavedSuggestion, patchDutyItem } from "@/lib/profile/useRoleDuties";
import { refreshFreeUsage } from "@/lib/hooks/useFreeUsesLeft";
import { useAccountGate } from "@/components/auth/AccountGate";
import type { RoleDutyItem, RoleDutySuggestion } from "@/types";

/** "checking" = looking for ideas already saved for this job title (free); "start" = none saved,
 * waiting for the candidate to ask - asking writes new ones, which uses one of a free plan's goes. */
export type SuggestedTasksStatus = "checking" | "start" | "loading" | "ready" | "error" | "limit-reached";

const GATE_COPY = {
  title: "Create your free account to see task ideas",
  submitLabel: "Create account & see ideas",
};

/**
 * Task ideas for one role in the resume editor's Suggest tasks panel. Same service, saved
 * suggestions and free-use limit as the profile's Suggest tasks (lib/profile/useRoleDuties.ts).
 * Opening the panel only looks up ideas already saved for the job title, which is free; new ones
 * are written only when the candidate asks ("Show task ideas", "More ideas"), so a free use is
 * never spent just by opening it.
 *
 * Its own small hook rather than useRoleDuties: that one also runs a background lookup on mount
 * for the profile's role cards, which could land after this panel's request and overwrite it.
 */
export function useSuggestedTasks({ jobTitle, company, location }: { jobTitle: string; company: string; location: string }) {
  const { isGuest, requireAccount } = useAccountGate();
  const [status, setStatus] = useState<SuggestedTasksStatus>(isGuest ? "start" : "checking");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [suggestion, setSuggestion] = useState<RoleDutySuggestion | null>(null);
  const [items, setItems] = useState<RoleDutyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // One request at a time (a double click must not write two batches), and nothing applied once
  // the panel has closed.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Set once the candidate has asked for ideas: from then on that request owns the panel, and the
  // saved-ideas lookup below (which can still be in flight, e.g. re-run when a guest signs up from
  // the "Show task ideas" click) must not overwrite it.
  const askedRef = useRef(false);

  // Ideas already saved for this title, if any - free, never writes or spends anything.
  const checkedRef = useRef(false);
  useEffect(() => {
    if (isGuest || checkedRef.current) return;
    checkedRef.current = true;
    void lookupSavedSuggestion(jobTitle).then((saved) => {
      if (!mountedRef.current || askedRef.current) return;
      if (saved) {
        setSuggestion(saved.suggestion);
        setItems(saved.items);
        setStatus("ready");
      } else {
        setStatus("start");
      }
    });
    // Once per panel (re-checked only when a guest becomes a real account).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  async function load(more: boolean) {
    // Claimed before any await, so a second click arriving meanwhile is turned away - and always
    // released, even if the account check itself fails, so the buttons never go dead.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    let result: Awaited<ReturnType<typeof fetchSuggestions>>;
    try {
      if (!(await requireAccount(GATE_COPY))) return;
      askedRef.current = true;
      if (more) setIsLoadingMore(true);
      else setStatus("loading");
      setError(null);
      result = await fetchSuggestions(jobTitle, company, location, more).catch(() => ({
        error: "Couldn't reach the server. Check your connection and try again.",
        code: undefined,
      }));
    } catch {
      result = { error: "Something went wrong. Please try again.", code: undefined };
    } finally {
      inFlightRef.current = false;
    }
    refreshFreeUsage();
    if (!mountedRef.current) return;
    setIsLoadingMore(false);
    if ("error" in result) {
      if (result.code === "FREE_LIMIT_REACHED") {
        // Running out on "More ideas" keeps the ideas already on screen usable.
        if (more) setError("You've used your free task suggestions. Upgrade for more ideas.");
        else setStatus("limit-reached");
        return;
      }
      setError(result.error);
      if (!more) setStatus("error");
      return;
    }
    setSuggestion(result.suggestion);
    setItems(result.items);
    setStatus("ready");
  }

  /** Records ticked tasks as done, the same way the profile does, so the profile and the next
   * generated resume both count them. Best effort: the bullets are already on the resume. */
  function confirm(picked: RoleDutyItem[]) {
    if (!suggestion) return;
    for (const item of picked) {
      if (item.user_state !== "confirmed") void patchDutyItem(suggestion.id, item.id, { user_state: "confirmed" }).catch(() => null);
    }
  }

  return { status, isLoadingMore, items, error, start: () => load(false), loadMore: () => load(true), confirm };
}
