// Fixed brand asset: colors are hardcoded (not design-token vars) so the
// mark renders identically everywhere it's embedded, including contexts
// with no access to the app's CSS (favicon, browser chrome, bookmarks).
export const LOGO_TERRACOTTA = "oklch(0.55 0.14 45)";
export const LOGO_INK = "oklch(0.22 0.02 75)";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-hidden="true" className={className}>
      <rect width="48" height="48" rx="11" fill={LOGO_TERRACOTTA} />
      <rect x="8" y="6" width="23" height="31" rx="3.5" fill="#fff" />
      <rect x="12.5" y="14" width="14" height="2.8" rx="1.4" fill={LOGO_TERRACOTTA} />
      <rect x="12.5" y="21" width="14" height="2.8" rx="1.4" fill={LOGO_TERRACOTTA} />
      <rect x="12.5" y="28" width="9" height="2.8" rx="1.4" fill={LOGO_TERRACOTTA} />
      <path d="M28.5 38.5 L34.5 38.5 L34.5 32.5 Z" fill={LOGO_INK} />
      <path d="M44 12 L27 42 L30.5 31 L16 34 Z" fill="#fff" />
    </svg>
  );
}
