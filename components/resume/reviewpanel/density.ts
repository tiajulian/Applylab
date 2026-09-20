import type { CSSProperties } from "react";

/** Every size the panel and its cards read, as CSS variables, so the panel is one style object and the
 * components carry one set of classes. text/small/title are font sizes; target is the minimum height
 * of a button; gutter is the panel's side margin, pad the padding inside a card, block inside a text block,
 * gap/listgap/chipy the space between things; leading is body line-height.
 * Desktop is tight to fit as much as possible; a phone keeps 44px touch targets. */
const SIZES = {
  desktop: { text: "11px", small: "10px", title: "15px", target: "28px", gutter: "10px", pad: "8px", gap: "6px", listgap: "4px", block: "8px", chipy: "4px", leading: "1.3" },
  phone: { text: "14px", small: "12px", title: "24px", target: "44px", gutter: "16px", pad: "16px", gap: "12px", listgap: "8px", block: "12px", chipy: "8px", leading: "1.6" },
} as const;

export const panelSizes = (isMobile: boolean): CSSProperties =>
  Object.fromEntries(Object.entries(SIZES[isMobile ? "phone" : "desktop"]).map(([name, value]) => [`--rp-${name}`, value])) as CSSProperties;
