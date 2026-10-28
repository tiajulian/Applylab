"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProInterval } from "@/lib/marketing/plans";
import { trackFunnelEvent } from "@/lib/analytics";

/**
 * Starts a Pro checkout for the chosen billing interval. Shared by every screen that sells Pro
 * (pricing page, /upgrade, the upsell modal, limit-reached prompts) so they all send the same
 * request and handle 401 the same way. Signed-out users return to `returnPath`, or the current
 * page. `pendingInterval` says which button is loading.
 */
export function useProCheckout(returnPath?: string) {
  const router = useRouter();
  const [pendingInterval, setPendingInterval] = useState<ProInterval | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(interval: ProInterval) {
    setPendingInterval(interval);
    setError(null);
    trackFunnelEvent("checkout_started", { plan: "pro", interval });

    // Wrapped so a network failure or non-JSON response can't leave the button stuck loading.
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval }),
      });

      if (response.status === 401) {
        router.push(`/login?redirectedFrom=${returnPath ?? window.location.pathname}`);
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.url) {
        setError(data.error ?? "Failed to start checkout");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPendingInterval(null);
    }
  }

  return { startCheckout, pendingInterval, error };
}
