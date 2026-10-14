"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FREE_TIER_FEATURE_LIMITS, type FreeTierLimitedFeature } from "@/lib/limits";
import type { Plan } from "@/types";

type Usage = { plan: Plan; used: Partial<Record<FreeTierLimitedFeature, number>> };

// One shared copy per page, so every capped button reads the same numbers and the API is called once.
let usage: Usage | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  loading ??= fetch("/api/user/free-usage")
    .then((response) => (response.ok ? response.json() : null))
    .then((data: Usage | null) => {
      usage = data;
      emit();
    })
    .catch(() => {
      // No label is better than a wrong one; the server still enforces the cap.
    });
  return loading;
}

/**
 * Free uses left for a capped AI feature, or null when there's nothing to show (Pro, signed out,
 * or not loaded yet). Lifetime allowance: it never resets.
 */
export function useFreeUsesLeft(feature: FreeTierLimitedFeature): number | null {
  const snapshot = useSyncExternalStore(subscribe, () => usage, () => null);

  useEffect(() => {
    void load();
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
  if (usage?.plan !== "free") return;
  loading = null;
  void load();
}
