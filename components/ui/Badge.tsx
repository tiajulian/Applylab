import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "accent" | "success" | "attention" | "critical";
}

const VARIANT_STYLES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-paper-deep text-ink-secondary",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  attention: "bg-attention-soft text-attention",
  critical: "bg-critical-soft text-critical",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}
