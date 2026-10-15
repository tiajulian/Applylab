import type { ReactNode } from "react";
import { clsx } from "@/lib/utils";

/** Plain wrapper kept for call sites; each StaggerItem animates itself in on paint. */
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/**
 * CSS-only entrance (no IntersectionObserver), so items added later - e.g. "+ Add role" on an
 * already-visible list - animate in on mount instead of mounting hidden and staying that way.
 */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("animate-fade-in-up", className)}>{children}</div>;
}
