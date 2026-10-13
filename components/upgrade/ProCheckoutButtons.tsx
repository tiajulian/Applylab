"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { useProCheckout } from "@/lib/hooks/useProCheckout";
import { PRO_FINE_PRINT, PRO_PRICES } from "@/lib/marketing/plans";

/**
 * "A$29 / month" and "A$59 / 3 months (Save 32%)", each starting checkout for its own interval.
 * Used wherever a free user is asked to go Pro without visiting /pricing (upsell modal,
 * limit-reached prompts). The 3-month button is the primary one and takes focus when asked.
 */
export function ProCheckoutButtons({
  returnPath,
  autoFocusQuarter = false,
  size,
}: {
  returnPath?: string;
  autoFocusQuarter?: boolean;
  size?: "sm";
}) {
  const { startCheckout, pendingInterval, error } = useProCheckout(returnPath);
  const quarterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocusQuarter) quarterRef.current?.focus();
  }, [autoFocusQuarter]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        ref={quarterRef}
        type="button"
        size={size}
        className="w-full justify-center font-bold shadow-sm"
        onClick={() => void startCheckout("quarter")}
        isLoading={pendingInterval === "quarter"}
        disabled={pendingInterval !== null}
      >
        {PRO_PRICES.quarter.buttonLabel} ({PRO_PRICES.quarter.savingLabel.toLowerCase()})
      </Button>
      <Button
        type="button"
        size={size}
        variant="outline"
        className="w-full justify-center font-bold"
        onClick={() => void startCheckout("month")}
        isLoading={pendingInterval === "month"}
        disabled={pendingInterval !== null}
      >
        {PRO_PRICES.month.buttonLabel}
      </Button>
      <p className="text-center text-xs text-ink-muted">{PRO_FINE_PRINT}</p>
      {error && <p className="text-center text-xs font-semibold text-critical">{error}</p>}
    </div>
  );
}
