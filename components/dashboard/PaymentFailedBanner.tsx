"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Shown to Pro users while Stripe is retrying a failed card (users.payment_failed, set by the
 * webhook). Opens the Stripe billing portal, where they can update the card; the next successful
 * charge clears the flag.
 */
export function PaymentFailedBanner() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openBillingPortal() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error ?? "Couldn't open billing. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't open billing. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-attention/30 bg-attention-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="text-sm text-ink">
        <p className="font-semibold">Your last payment didn&apos;t go through.</p>
        <p className="text-ink-secondary">Update your card to keep Pro. We&apos;ll try the payment again after that.</p>
        {error && <p className="mt-1 text-xs font-semibold text-critical">{error}</p>}
      </div>
      <Button type="button" size="sm" onClick={openBillingPortal} isLoading={isLoading} className="shrink-0">
        Update card
      </Button>
    </div>
  );
}
