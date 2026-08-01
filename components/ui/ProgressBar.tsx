"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { clsx } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  trackClassName,
  barClassName,
}: {
  /** 0 to 100 */
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      ref={ref}
      className={clsx(
        "h-2 w-full overflow-hidden rounded-pill bg-paper-deep",
        trackClassName,
        className
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={clsx("h-full rounded-pill bg-accent", barClassName)}
        initial={{ width: 0 }}
        animate={{ width: isInView ? `${clamped}%` : 0 }}
        transition={
          reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }
        }
      />
    </div>
  );
}
