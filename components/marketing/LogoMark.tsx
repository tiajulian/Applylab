// Fixed brand asset: colors are hardcoded (not design-token vars) so the
// mark renders identically everywhere it's embedded, including contexts
// with no access to the app's CSS (favicon, browser chrome, bookmarks).
export const LOGO_TERRACOTTA = "oklch(0.55 0.14 45)";
export const LOGO_INK = "oklch(0.22 0.02 75)";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="11" fill={LOGO_TERRACOTTA} />
      <rect x="9" y="7" width="21" height="28" rx="3.5" fill="#fff" />
      <rect x="13" y="15" width="13" height="2.6" rx="1.3" fill={LOGO_TERRACOTTA} />
      <rect x="13" y="21" width="13" height="2.6" rx="1.3" fill={LOGO_TERRACOTTA} />
      <rect x="13" y="27" width="8" height="2.6" rx="1.3" fill={LOGO_TERRACOTTA} />
      <path d="M29.5 32.5 L33 33 L31 37.5 Z" fill={LOGO_INK} />
      <path d="M33.9 24.2 L46.4 26.5 L37.3 37.8 L30.75 31.6 L24.2 33.9 Z" fill="#fff" />
    </svg>
  );
}
