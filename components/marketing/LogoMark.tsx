// Fixed brand asset. The icon is the exact source PNG (public/logo-icon.png,
// from design_handoff_logo/logo-icon.png) rendered as-is — not a hand-traced
// vector recreation, since a hand-traced version didn't match closely enough.
// Colors below are only for the wordmark text in Logo.tsx, kept in sync with
// the icon's terracotta/ink so the lockup reads as one unit.
export const LOGO_TERRACOTTA = "oklch(0.55 0.14 45)";
export const LOGO_INK = "oklch(0.22 0.02 75)";

export function LogoMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- exact static brand asset, no need for next/image optimization
    <img src="/logo-icon.png" alt="" aria-hidden="true" width={38} height={38} className={className} />
  );
}
