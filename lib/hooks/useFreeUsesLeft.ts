"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FREE_TIER_FEATURE_LIMITS, type FreeTierLimitedFeature } from "@/lib/limits";
import type { Plan } from "@/types";

type Usage = { plan: Plan; used: Partial<Record<FreeTierLimitedFeature, number>> };

// One shared copy per page, so every capped button reads the same numbers and the API is called once.
let usage: Usage | null = null;
let requested = false;
// Bumped on every fetch, so a slower, older response can never overwrite a newer one.
let generation = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  const current = ++generation;
  requested = true;
  void fetch("/api/user/free-usage")
    .then((response) => {
      // Signed out / not allowed: there's nothing to show and retrying won't change that.
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error(`free usage ${response.status}`);
      return response.json() as Promise<Usage>;
    })
    .then((data) => {
      if (current !== generation) return;
      usage = data;
      emit();
    })
    .catch(() => {
      // No label is better than a wrong one (the server still enforces the cap): drop the old
      // numbers, and let the next label that mounts try again.
      if (current !== generation) return;
      usage = null;
      requested = false;
      emit();
    });
}

/**
 * Free uses left for a capped AI feature, or null when there's nothing to show (Pro, signed out,
 * or not loaded yet). Lifetime allowance: it never resets.
 */
export function useFreeUsesLeft(feature: FreeTierLimitedFeature): number | null {
  const snapshot = useSyncExternalStore(subscribe, () => usage, () => null);

  useEffect(() => {
    if (!requested) load();
  }, []);

  if (!snapshot || snapshot.plan !== "free") return null;
  return Math.max(0, FREE_TIER_FEATURE_LIMITS[feature] - (snapshot.used[feature] ?? 0));
}

/**
 * Re-reads usage after a capped AI call finishes (success or limit reached). The server is the
 * only one that knows whether a call actually used a credit (cache hits and refunded failures
 * don't), so the label refetches rather than counting down on its own.
 */
export function refreshFreeUsage(): void {
  if (usage && usage.plan !== "free") return;
  if (listeners.size === 0) {
    // No label on screen right now: drop the stale numbers (and any in-flight fetch) and refetch
    // when the next label mounts, so it never shows an out-of-date count.
    usage = null;
    generation += 1;
    requested = false;
    return;
  }
  load();
}
