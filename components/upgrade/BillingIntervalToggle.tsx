"use client";

import { clsx } from "@/lib/utils";
import { PRO_PRICES, type ProInterval } from "@/lib/marketing/plans";

const OPTIONS: { value: ProInterval; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "3 months" },
];

/** Monthly / 3-month switch shared by /pricing and /upgrade. */
export function BillingIntervalToggle({
  value,
  onChange,
  className,
}: {
  value: ProInterval;
  onChange: (interval: ProInterval) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className={clsx("inline-flex rounded-pill border border-border bg-surface p-1 shadow-sm", className)}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              "rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "bg-accent-hover text-on-accent" : "text-ink-secondary hover:text-ink"
            )}
          >
            {option.label}
            {option.value === "quarter" && (
              <span className={clsx("ml-1.5 text-xs font-bold", selected ? "text-on-accent" : "text-success")}>
                {PRO_PRICES.quarter.savingLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Pro price for an interval. The billed amount is always the most prominent number; the
 * quarterly per-month figure is secondary text only.
 */
export function ProPriceDisplay({
  interval,
  amountClassName = "font-display text-[36px] sm:text-[42px] font-bold text-ink",
}: {
  interval: ProInterval;
  amountClassName?: string;
}) {
  const price = PRO_PRICES[interval];
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-1">
        <span className={amountClassName}>{price.label}</span>
        <span className="text-body text-ink-muted">{interval === "quarter" ? "every 3 months" : price.cadence}</span>
      </div>
      {interval === "quarter" && (
        <p className="mt-1 text-meta text-ink-muted">
          {PRO_PRICES.quarter.perMonthLabel} · {PRO_PRICES.quarter.savingLabel}
        </p>
      )}
    </div>
  );
}
