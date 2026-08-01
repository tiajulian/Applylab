"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

export function CountUp({
  value,
  suffix = "",
  prefix = "",
  className,
  duration = 0.8,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
}) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(nodeRef, { once: true, margin: "-40px" });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (!isInView) return;

    if (reduceMotion) {
      node.textContent = `${prefix}${value}${suffix}`;
      return;
    }

    const controls = animate(0, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate(latest) {
        node.textContent = `${prefix}${Math.round(latest)}${suffix}`;
      },
    });

    return () => controls.stop();
  }, [isInView, value, prefix, suffix, duration, reduceMotion]);

  return (
    <span ref={nodeRef} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
