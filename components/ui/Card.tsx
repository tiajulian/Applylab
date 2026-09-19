import { HTMLAttributes } from "react";
import { clsx } from "@/lib/utils";

type CardDensity = "content" | "compact";

// content (24px): profile sections, settings, review panels.
// compact (16px): stat tiles, kanban cards/columns, inline banners.
const DENSITY_PADDING: Record<CardDensity, string> = {
  content: "p-6",
  compact: "p-4",
};

// If className already carries a padding utility, skip the density default so the
// two classes don't silently fight over the cascade (the later-in-scale one always
// won, so e.g. className="p-4" on top of a hardcoded "p-6" base always rendered p-6).
const HAS_PADDING_UTILITY = /(?:^|\s)(?:p|px|py|pt|pb|pl|pr)-\S/;

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  density?: CardDensity;
}

export function Card({ className = "", density = "content", ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-border bg-surface",
        HAS_PADDING_UTILITY.test(className) ? undefined : DENSITY_PADDING[density],
        className
      )}
      {...props}
    />
  );
}
