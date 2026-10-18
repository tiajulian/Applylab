// Fixed brand asset. The icon is the exact source PNG (public/logo-icon.png,
// from design_handoff_logo/logo-icon.png) rendered as-is — not a hand-traced
// vector recreation, since a hand-traced version didn't match closely enough.
// Colors below are only for the wordmark text in Logo.tsx: brand-700 (the logo's hue, dark
// enough for text) and the ink token, so the lockup reads as one unit.
export const LOGO_TERRACOTTA = "rgb(var(--brand-700))";
export const LOGO_INK = "rgb(var(--neutral-900))";

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- exact static brand asset, no need for next/image optimization
    <img src="/logo-icon.png" alt="" aria-hidden="true" width={38} height={38} className={className} />
  );
}
