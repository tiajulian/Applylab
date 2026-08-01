"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { clsx } from "@/lib/utils";

export function UpgradeCard({
  plan,
  title,
  price,
  cadence,
  features,
  highlight,
}: {
  plan: "pro" | "lifetime";
  title: string;
  price: string;
  cadence: string;
  features: string[];
  highlight?: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setIsLoading(true);
    setError(null);

    // Wrapped so a network failure or non-JSON response can't leave isLoading stuck true
    // forever with no error shown — see ResumeForm.tsx for the production incident this
    // pattern caused elsewhere in the app.
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (response.status === 401) {
        router.push("/login?redirectedFrom=/upgrade");
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
      setIsLoading(false);
    }
  }

  return (
    <div
      className={clsx(
        "flex flex-col rounded border bg-surface p-8 transition-transform duration-fast ease-editorial hover:-translate-y-px active:translate-y-px",
        highlight ? "border-accent" : "border-border"
      )}
    >
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      <p className="mt-2">
        <span className="font-display text-h2 text-ink">{price}</span>{" "}
        <span className="text-ink-secondary">{cadence}</span>
      </p>
      <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-secondary">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <span className="text-success">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant={highlight ? "primary" : "outline"}
        className="mt-8"
        onClick={handleCheckout}
        isLoading={isLoading}
      >
        Get {title}
      </Button>
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
