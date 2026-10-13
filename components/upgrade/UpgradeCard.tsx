"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { clsx } from "@/lib/utils";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { BillingIntervalToggle, ProPriceDisplay } from "@/components/upgrade/BillingIntervalToggle";
import { useProCheckout } from "@/lib/hooks/useProCheckout";
import { PRO_FINE_PRINT, type ProInterval } from "@/lib/marketing/plans";

/** The Pro card on /upgrade: same monthly / 3-month toggle as /pricing, checkout for the chosen interval. */
export function UpgradeCard({
  title,
  audience,
  features,
  highlight,
  initialInterval = "month",
}: {
  title: string;
  audience?: string;
  features: readonly string[];
  highlight?: boolean;
  initialInterval?: ProInterval;
}) {
  const [interval, setBillingInterval] = useState<ProInterval>(initialInterval);
  const { startCheckout, pendingInterval, error } = useProCheckout("/upgrade");

  return (
    <div
      className={clsx(
        "flex flex-col rounded-lg border bg-surface p-8 transition-transform duration-fast ease-editorial hover:-translate-y-px active:translate-y-px",
        highlight ? "border-accent" : "border-border"
      )}
    >
      <h2 className="text-h3 font-semibold text-ink">{title}</h2>
      <BillingIntervalToggle value={interval} onChange={setBillingInterval} className="mt-3 self-start" />
      <div className="mt-3">
        <ProPriceDisplay interval={interval} amountClassName="font-display text-h2 text-ink" />
      </div>
      {audience && <p className="mt-2 text-sm text-ink-secondary">{audience}</p>}
      <ul className="mt-6 flex flex-col gap-2 text-sm text-ink-secondary">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 shrink-0 text-success" />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant={highlight ? "primary" : "outline"}
        className="mt-8"
        onClick={() => void startCheckout(interval)}
        isLoading={pendingInterval !== null}
      >
        Go {title}
      </Button>
      <p className="mt-2 text-center text-xs text-ink-muted">{PRO_FINE_PRINT}</p>
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
