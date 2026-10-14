"use client";

import { useFreeUsesLeft } from "@/lib/hooks/useFreeUsesLeft";
import type { FreeTierLimitedFeature } from "@/lib/limits";

/** " · 3 left" after a capped AI button's label, for free users only. Renders nothing on Pro. */
export function FreeUsesLeft({ feature }: { feature: FreeTierLimitedFeature }) {
  const left = useFreeUsesLeft(feature);
  if (left === null) return null;
  return <span className="font-normal opacity-75"> · {left} left</span>;
}
