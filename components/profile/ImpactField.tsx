"use client";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";

/**
 * The metric half of ImpactField, on its own - reused directly by the Win Builder's "A number?"
 * step (components/profile/WinBuilder.tsx), which already collects the outcome text on an earlier
 * step and only needs this piece. Same copy, same never-suggested guarantee, wherever it's used.
 */
export function MetricInput({
  label = "Metric (optional)",
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <Input
        label={label}
        placeholder="Number or metric (optional) - e.g. 30%, $50k, 3 new hires"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-ink-muted">No number is fine. We never suggest or fill one in for you.</p>
    </>
  );
}

/**
 * Reusable impact capture: an optional "what did this achieve, or why did it matter?" text field
 * plus an optional real number/metric field. Used everywhere the app asks a candidate for impact
 * (work experience achievement, standalone projects, confirmed role-duty tasks) so the shape and
 * the honesty guarantees stay identical across all three: the product asks, the user answers, no
 * number is ever suggested or pre-filled, and "no number"/"no impact" are equal-weight, penalty-
 * free choices - a plain honest entry with neither is still a good outcome.
 */
export function ImpactField({
  id,
  label,
  recommended,
  description,
  examples,
  textValue,
  onTextChange,
  textPlaceholder,
  metricValue,
  onMetricChange,
  rows = 2,
}: {
  id: string;
  label: string;
  recommended?: boolean;
  description: string;
  examples?: string;
  textValue: string;
  onTextChange: (value: string) => void;
  textPlaceholder?: string;
  metricValue: string;
  onMetricChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-secondary">
          {label}
        </label>
        {recommended && <Badge variant="accent">Recommended</Badge>}
      </div>
      <p className="text-xs text-ink-secondary">{description}</p>
      <Textarea
        id={id}
        rows={rows}
        placeholder={textPlaceholder}
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
      />
      {examples && <p className="text-xs text-ink-muted">{examples}</p>}
      <MetricInput label="Metric (optional)" value={metricValue} onChange={onMetricChange} />
    </div>
  );
}
