"use client";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";

/**
 * Reusable impact capture: an optional "what did this achieve, or why did it matter?" text field
 * plus an optional real number/metric field. Used everywhere the app asks a candidate for impact
 * (work experience achievement, standalone projects, confirmed role-duty tasks) so the shape and
 * the honesty guarantees stay identical across all three: the product asks, the user answers, no
 * number is ever suggested or pre-filled, and "no number"/"no impact" are equal-weight, penalty-
 * free choices - a plain honest entry with neither is still a good outcome.
 */
export function ImpactField({
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
        <label className="text-sm font-medium text-ink-secondary">{label}</label>
        {recommended && <Badge variant="accent">Recommended</Badge>}
      </div>
      <p className="text-xs text-ink-secondary">{description}</p>
      <Textarea rows={rows} placeholder={textPlaceholder} value={textValue} onChange={(e) => onTextChange(e.target.value)} />
      {examples && <p className="text-xs text-ink-muted">{examples}</p>}
      <Input
        placeholder="Number or metric (optional) - e.g. 30%, $50k, 3 new hires"
        value={metricValue}
        onChange={(e) => onMetricChange(e.target.value)}
      />
      <p className="text-xs text-ink-muted">No number is fine. We never suggest or fill one in for you.</p>
    </div>
  );
}
