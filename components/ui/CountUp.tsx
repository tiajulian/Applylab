"use client";

import { useLayoutEffect, useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

// The JSX below renders the real, final `value` (not a placeholder), so on a value change React
// paints that final number at commit before any effect runs. A plain useEffect fires after that
// paint, so it would visibly reset the text back down to `from` for a frame before animating back
// up - a smaller version of the exact flash this component exists to avoid. useLayoutEffect runs
// before the browser paints, pre-empting that. It's a no-op during SSR (guarded here so it never
// runs server-side, matching useEffect's SSR behaviour and avoiding React's dev warning).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  // null means "nothing shown yet" - distinguishes a genuine first reveal (jump straight to the
  // final value; it's already computed, there's nothing to visualise counting up from) from a
  // later change to an already-displayed number (e.g. a re-score), which is the only case worth
  // animating. Without this, every value change replayed 0 -> value, which made an already-final
  // number (a freshly loaded ATS score, a skills-bridge match count) look like it was still being
  // computed as it flashed through intermediate values on the way up.
  const shownValue = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (!isInView) return;

    const from = shownValue.current;
    shownValue.current = value;

    if (from === null || reduceMotion) {
      node.textContent = `${prefix}${value}${suffix}`;
      return;
    }

    const controls = animate(from, value, {
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
      {prefix}{value}{suffix}
    </span>
  );
}
