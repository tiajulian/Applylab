import type { ReactNode } from "react";
import { clsx } from "@/lib/utils";

/**
 * Soft entrance for a block of content. Pure CSS (see `animate-fade-in-up` in
 * tailwind.config.ts), so it plays on first paint with no JavaScript, and the content can never
 * get stuck invisible waiting for hydration or an IntersectionObserver. Reduced-motion users get
 * the end state immediately via the global rule in globals.css.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={clsx("animate-fade-in-up", className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
