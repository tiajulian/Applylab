import type { CSSProperties } from "react";

/** Every size the panel and its cards read, as CSS variables, so the panel is one style object and the
 * components carry one set of classes. text/small/title are font sizes; target is the minimum height
 * of a button; pad/gap/listgap/block/chipy are spacing; leading is body line-height.
 * Desktop is tight to fit as much as possible; a phone keeps 44px touch targets. */
const SIZES = {
  desktop: { text: "11px", small: "10px", title: "15px", target: "28px", pad: "6px", gap: "4px", listgap: "3px", block: "6px", chipy: "3px", leading: "1.25" },
  phone: { text: "14px", small: "12px", title: "24px", target: "44px", pad: "16px", gap: "12px", listgap: "8px", block: "12px", chipy: "8px", leading: "1.6" },
} as const;

export const panelSizes = (isMobile: boolean): CSSProperties =>
  Object.fromEntries(Object.entries(SIZES[isMobile ? "phone" : "desktop"]).map(([name, value]) => [`--rp-${name}`, value])) as CSSProperties;
