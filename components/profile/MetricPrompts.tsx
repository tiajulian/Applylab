"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/utils";
import { MetricInput } from "@/components/profile/ImpactField";
import { METRIC_BLANK, orderMetricPrompts, type MetricPrompt } from "@/lib/wins/constants";

/**
 * The Win Builder's number step: question chips that help the candidate recall a real figure.
 * Tapping one inserts a template with a blank and selects the blank, so typing replaces it. It
 * never inserts a number.
 */
export function MetricPrompts({
  value,
  onChange,
  outcome,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The outcome picked in the step before, used to put the most relevant prompt first. */
  outcome: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<MetricPrompt | null>(null);
  // Bumped on every tap so re-tapping the same chip re-selects its blank.
  const [selectTick, setSelectTick] = useState(0);

  useEffect(() => {
    if (selectTick === 0) return;
    const input = inputRef.current;
    if (!input) return;
    const start = input.value.indexOf(METRIC_BLANK);
    input.focus();
    if (start >= 0) input.setSelectionRange(start, start + METRIC_BLANK.length);
  }, [selectTick]);

  // A figure the candidate typed themselves is kept: the tap then only shows the question.
  function pick(prompt: MetricPrompt) {
    setActive(prompt);
    if (value.trim() && !hasMetricBlank(value)) return;
    onChange(prompt.template);
    setSelectTick((t) => t + 1);
  }
  const shown = value.trim() ? active : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {orderMetricPrompts(outcome).map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            aria-pressed={shown?.label === prompt.label}
            onClick={() => pick(prompt)}
            className={clsx(
              "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial",
              shown?.label === prompt.label
                ? "border-transparent bg-accent-soft font-semibold text-accent"
                : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
            )}
          >
            {prompt.label}
          </button>
        ))}
      </div>
      {shown && <p className="text-sm text-ink-secondary">{shown.question}</p>}
      <MetricInput inputRef={inputRef} value={value} onChange={onChange} />
      {hasMetricBlank(value) && (
        <p className="text-xs font-medium text-attention" role="status">
          Fill in the blank or clear it.
        </p>
      )}
    </div>
  );
}

/** True while a tapped template's blank is still unfilled. */
export function hasMetricBlank(metric: string): boolean {
  return metric.includes(METRIC_BLANK);
}
