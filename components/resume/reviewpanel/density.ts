import type { CSSProperties } from "react";

/** How much of the review panel fits on screen. Roomy keeps 44px touch targets; Tight fits the most. */
export type Density = "roomy" | "compact" | "tight";
export const DENSITY_ORDER: readonly Density[] = ["roomy", "compact", "tight"];

const STORAGE_KEY = "applylab:review-density";

/** Every size the panel and its cards read, as CSS variables, so a density is one style object and
 * the components carry one set of classes. text/small/title are font sizes; target is the minimum
 * height of a button; pad/gap/listgap/block/chipy are spacing; leading is body line-height. */
const SIZES: Record<Density, { label: string; vars: Record<string, string> }> = {
  roomy: {
    label: "Roomy",
    vars: { text: "14px", small: "12px", title: "24px", target: "44px", pad: "16px", gap: "12px", listgap: "8px", block: "12px", chipy: "8px", leading: "1.6" },
  },
  compact: {
    label: "Compact",
    vars: { text: "13px", small: "12px", title: "20px", target: "36px", pad: "12px", gap: "8px", listgap: "6px", block: "10px", chipy: "6px", leading: "1.4" },
  },
  tight: {
    label: "Tight",
    vars: { text: "12px", small: "11px", title: "18px", target: "30px", pad: "8px", gap: "6px", listgap: "4px", block: "8px", chipy: "4px", leading: "1.3" },
  },
};

export const densityLabel = (d: Density) => SIZES[d].label;

export const densityStyle = (d: Density): CSSProperties =>
  Object.fromEntries(Object.entries(SIZES[d].vars).map(([name, value]) => [`--rp-${name}`, value])) as CSSProperties;

const isDensity = (v: unknown): v is Density => DENSITY_ORDER.includes(v as Density);

/** The remembered choice, else Compact on a desktop and Roomy on a phone. Storage can be blocked. */
export function loadDensity(isMobile: boolean): Density {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDensity(stored)) return stored;
  } catch {
    // Private mode or blocked storage: fall through to the default.
  }
  return isMobile ? "roomy" : "compact";
}

export function saveDensity(d: Density): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, d);
  } catch {
    // The choice just won't be remembered.
  }
}
