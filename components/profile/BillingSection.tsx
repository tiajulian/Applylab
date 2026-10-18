"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** Opens the Stripe billing portal (payment method, invoices, cancel). */
export function ManageBillingButton({ label = "Manage billing", className }: { label?: string; className?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManageBilling() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.url) {
        setError(data.error ?? "Failed to open billing portal");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" variant="outline" size="sm" onClick={handleManageBilling} isLoading={isLoading}>
        {label}
      </Button>
      {error && <p className="mt-3 text-sm text-critical">{error}</p>}
    </div>
  );
}

export function BillingSection() {
  return (
    <Card>
      <h2 className="text-h3 font-semibold text-ink">Billing</h2>
      <p className="mt-1 text-sm text-ink-secondary">
        Update your payment method, view invoices, or cancel your Pro subscription. Cancelling
        stops future renewals — you keep Pro access until the end of your current billing period.
      </p>
      <ManageBillingButton className="mt-4" />
    </Card>
  );
}
